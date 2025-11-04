import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { SubmagicService } from '../submagic/submagic.service';
import {
  MediaMatchingRequestDto,
  MediaMatchingResponseDto,
  MediaMatchDto,
  MediaItemDto,
  UpdateProjectRequestDto,
} from '../../common/dto/media-matching.dto';
import { MEDIA_ITEMS } from 'api/src/common/constants/media-items';
import { match } from 'assert';

// Local interface definition
// interface TextSegment {
//   text: string;
//   startTime: number;
//   endTime: number;
//   words: WordSegment[];
// }

interface WordSegment {
  id: string;
  text: string;
  startTime: number;
  endTime: number;
  type: string;
}

type WordSeg = { id: string; text: string; type: 'word'|'silence'|'punctuation'; startTime: number; endTime: number };
type TextSegment = { startTime: number; endTime: number; text: string };

type LibraryItem = { userMediaId: string; description: string; tags?: string[] };


@Injectable()
export class OpenAIService {
  private readonly logger = new Logger(OpenAIService.name);
  private readonly openai: OpenAI;

  constructor(
    private readonly configService: ConfigService,
    private readonly submagicService: SubmagicService,
  ) {
    const apiKey = this.configService.get<string>('OPEN_API_KEY') || '';

    if (!apiKey) {
      throw new Error('OpenAI API key is required');
    }

    this.openai = new OpenAI({
      apiKey,
    });
  }


  async analyzeProjectForMediaMatching(
    request: MediaMatchingRequestDto,
  ): Promise<MediaMatchingResponseDto> {
    try {
      this.logger.log(`Starting media matching analysis for project: ${request.projectId}`);
      
      // Get project data from Submagic
      const projectData = await this.getProjectData(request.projectId);
      this.logger.log(`Retrieved project data with ${projectData?.words?.length || 0} words`);

      if (!projectData || !projectData.words || projectData.words.length === 0) {
        this.logger.warn(`No words found in project ${request.projectId}`);
        return {
          projectId: request.projectId,
          matches: [],
          totalMatches: 0,
          processedAt: new Date().toISOString(),
        };
      }

      // Extract meaningful text segments from the words array
      const textSegments = this.segmentWords(projectData.words);
      console.log('TEXT SEGMENTS: ', textSegments);
      this.logger.log(`Extracted ${textSegments.length} meaningful segments`);

      if (textSegments.length === 0) {
        this.logger.warn(`No meaningful segments extracted from project ${request.projectId}`);
        return {
          projectId: request.projectId,
          matches: [],
          totalMatches: 0,
          processedAt: new Date().toISOString(),
        };
      }
      
      const matches = await this.findMediaMatches({ 
        segments: textSegments, 
        library: request.mediaItems ?? MEDIA_ITEMS,
        words: projectData.words 
      });


      // // Deduplicate and sort matches
      const finalMatches = this.deduplicateMatches(matches);
      this.logger.log(`Found ${finalMatches.length} matches`);

      return {
        projectId: request.projectId,
        matches: matches,
        totalMatches: matches.length,
        processedAt: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Error analyzing project for media matching: ${error.message}`);
      throw new InternalServerErrorException(
        'Failed to analyze project for media matching',
      );
    }
  }

  async analyzeAndUpdateProject(
    request: UpdateProjectRequestDto,
  ): Promise<any> {
    try {
      this.logger.log(
        `Starting update for project ${request.projectId} with ${request.matches.length} media matches`,
      );

      // Directly update the project with the provided matches
      const updateResult = await this.updateProjectWithMatches(
        request.projectId,
        request.matches,
      );

      this.logger.log(
        `Successfully updated project ${request.projectId} with ${request.matches.length} matches`,
      );

      return {
        projectId: request.projectId,
        matchesApplied: request.matches.length,
        update: updateResult,
        processedAt: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `Error updating project: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Failed to update project with media matches',
      );
    }
  }

  async updateProjectWithMatches(
    projectId: string,
    matches: MediaMatchDto[],
  ): Promise<any> {
    try {
      this.logger.log(
        `Updating project ${projectId} with ${matches.length} media matches`,
      );

      // Transform matches to the format expected by Submagic API (UpdateProjectDto)
      const updateData = {
        items: matches.map((match) => ({
          userMediaId: match.userMediaId,
          startTime: match.startTime,
          endTime: match.endTime,
        })),
      };

      // Call Submagic API to update the project
      const result = await this.submagicService.updateProject(
        projectId,
        updateData,
      );

      this.logger.log(
        `Successfully updated project ${projectId} with media matches`,
      );
      return result;
    } catch (error) {
      // console.error('ERROR', error)
      // this.logger.error(
      //   `Error updating project with matches: ${error.message}`,
      //   error.stack,
      // );
      throw new InternalServerErrorException(
        'Failed to update project with media matches',
      );
    }
  }

  private async getProjectData(projectId: string): Promise<any> {
    try {
      return await this.submagicService.getProject(projectId);
    } catch (error) {
      this.logger.error(`Error fetching project data: ${error.message}`);
      throw error;
    }
  }

  

  segmentWords(words: WordSeg[], opts?: {
  maxGap?: number;          // split when silence exceeds this (seconds)
  minWords?: number;        // discard tiny fragments
  maxDuration?: number;     // force a cut if a segment runs too long
}) : TextSegment[] {
  const maxGap = opts?.maxGap ?? 0.6;
  const minWords = opts?.minWords ?? 6;
  const maxDuration = opts?.maxDuration ?? 12;

  const segs: TextSegment[] = [];
  let buf: WordSeg[] = [];

  const flush = () => {
    const wordsOnly = buf.filter(w => w.type === 'word');
    if (wordsOnly.length >= minWords) {
      segs.push({
        startTime: wordsOnly[0].startTime,
        endTime: wordsOnly[wordsOnly.length - 1].endTime,
        text: wordsOnly.map(w => w.text).join(' ')
      });
    }
    buf = [];
  };

  for (let i = 0; i < words.length; i++) {
    const w = words[i];

    if (w.type === 'silence') {
      const gap = w.endTime - w.startTime;
      if (gap >= maxGap) {
        flush();
        continue;
      }
      // short pauses just continue
      continue;
    }

    buf.push(w);

    // cut on sentence-like punctuation or overlong segments
    const isSentenceEnd = (w.type === 'punctuation' && /[.!?]/.test(w.text));
    const duration = buf.length ? (buf[buf.length - 1].endTime - buf[0].startTime) : 0;

    if (isSentenceEnd || duration >= maxDuration) {
      flush();
    }
  }
  flush();
  return segs;
}

  async findMediaMatches({
  segments,
  library,
  words
}: {
  segments: TextSegment[];
  library: LibraryItem[];
  words?: WordSeg[];
}): Promise<MediaMatchDto[]> {

  this.logger.log('MEDIA ITEMS: ', library);

  this.logger.log(`Processing ${segments.length} segments for media matching`);

  // Only consider segments that end after 5s (we can't place media before that)
  const MIN_START = 2.5;
  const MAX_CLIP = 5.0;
  const PRE_ROLL = 2.0;  // start this many seconds before the spoken phrase

  // Trim to first 20 meaningful segments that occur after 5s
  // const afterFive = segments
  //   .filter(s => s.startTime > MIN_START)
  //   .map(s => ({
  //     ...s,
  //     // if a segment crosses the 5s boundary, shift its usable start
  //     startTime: Math.max(s.startTime, MIN_START)
  //   }));

  const segmentsToProcess = segments;
  this.logger.debug('SEGMENTS TO PROCESS: ', segmentsToProcess);

  this.logger.log(`Using ${segmentsToProcess.length} segments for OpenAI analysis`);

  const system = `You are matching narration segments to b-roll footage.
Return ONLY: {"matches":[{userMediaId,startTime,endTime,confidence,reason,matchedText}]}

Rules:
- Place the FIRST engagement match in the 2.5s–6.0s window (mandatory).
- Never place media before 2.5s.
- Use each userMediaId at most once (one media per segment).
- Each placement must be <= 4.0 seconds long and lie within the segment window.
- Use literal, visual cues (actions/objects/moods). Include the trigger text in matchedText.
- Consider both the description AND tags when matching — tags represent key themes and concepts.
- Match based on semantic relevance, emotions, actions, and thematic alignment.
Library (ID: Description | Tags):
${library.map(item => {
  const tags = item.tags && item.tags.length > 0 ? item.tags.join(', ') : 'no tags';
  return `${item.userMediaId}: ${item.description} | Tags: ${tags}`;
}).join('\n')}`;

  const user = {
     note: "Respond ONLY in proper JSON — do not include any text before or after the JSON object. Ensure at least one early placement between 2.5s–6.0s.",
    segments: segmentsToProcess.map(seg => ({
      text: seg.text,
      startTime: seg.startTime,
      endTime: seg.endTime
    }))
  };

  try {
    const completion = await this.openai.chat.completions.create({
      model: 'gpt-5-mini',
      temperature: 1, // more deterministic
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: JSON.stringify(user) }
      ]
    });

    const responseContent = completion.choices[0].message.content;
    this.logger.log(`OpenAI response: ${responseContent}`);

    const parsed = JSON.parse(responseContent || '{}');
    let matches: MediaMatchDto[] = Array.isArray(parsed.matches) ? parsed.matches : [];
    this.logger.log("MATCHES ", matches)

    // ---- HARD GUARD-RAILS (post-process) ----
    const used = new Set<string>();

    matches = matches
      // keep only valid schema
      .filter(m => m && typeof m.userMediaId === 'string')
      // enforce min start time
      .map(m => ({
        ...m,
        startTime: Math.max(m.startTime ?? MIN_START, MIN_START)
      }))
      // enforce <= 4s duration and stay within segment windows if present
      // .map(m => {
      //   const duration = Math.max(0, (m.endTime ?? m.startTime) - m.startTime);
      //   let endTime = m.endTime ?? (m.startTime + Math.min(MAX_CLIP, duration || MAX_CLIP));
      //   if (endTime - m.startTime > MAX_CLIP) endTime = m.startTime + MAX_CLIP;
      //   return { ...m, endTime };
      // })
      // enforce confidence with exception for first engagement window (2.5–6.0s)
      // .filter(m => {
      //   const conf = m.confidence ?? 0;
      //   const inEarlyWindow = m.startTime >= MIN_START && m.startTime <= 6.0;
      //   return conf >= (inEarlyWindow ? 0.5 : 0.65);
      // })
      // de-duplicate by userMediaId (keep highest confidence)
      .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))
      .filter(m => {
        const key = m.userMediaId;
        if (used.has(m.userMediaId)) return false;
        used.add(m.userMediaId);
        return true;
      })
      // sort by time for downstream editors
      .sort((a, b) => a.startTime - b.startTime);

    // final safety: clip any negative or NaN
    matches = matches.map(m => ({
      ...m,
      startTime: Math.max(0, Number.isFinite(m.startTime) ? m.startTime : MIN_START),
      endTime: Math.max(0, Number.isFinite(m.endTime) ? m.endTime : m.startTime + MAX_CLIP)
    }));

   

    this.logger.debug('MATCHES BEFORE RE-ANCHORING: ', matches);

    // Re-anchor matches to actual text occurrence with pre-roll
    // if (words && words.length > 0) {
    //   matches = matches.map(match => {
    //     if (!match.matchedText) {
    //       return match; // Skip if no matched text
    //     }

    //     // Find the segment that contains this match
    //     const containingSegment = segments.find(segment => 
    //       match.startTime >= segment.startTime && match.startTime <= segment.endTime
    //     );

    //     if (!containingSegment) {
    //       return match; // Skip if no containing segment found
    //     }

    //     // Find when the matched text actually occurs
    //     // const textOccurrenceTime = this.findTextOccurrenceTime(
    //     //   match.matchedText,
    //     //   words,
    //     //   containingSegment.startTime,
    //     //   containingSegment.endTime
    //     // );

    //     // if (textOccurrenceTime !== null) {
    //     //   // Re-anchor with pre-roll, but don't go below 0
    //     //   const newStartTime = Math.max(0, textOccurrenceTime - PRE_ROLL);
    //     //   const duration = match.endTime - match.startTime;
    //     //   const newEndTime = newStartTime + duration;

    //     //   this.logger.log(`Re-anchored match "${match.matchedText}": ${match.startTime}s -> ${newStartTime}s (text at ${textOccurrenceTime}s, PRE_ROLL: ${PRE_ROLL}s)`);

    //     //   return {
    //     //     ...match,
    //     //     startTime: newStartTime,
    //     //     endTime: newEndTime
    //     //   };
    //     // }

    //     return match; // Keep original timing if text not found
    //   });
    // }

     this.logger.log("MATCHES FILTERED ", matches.length)

    this.logger.log(`Returning ${matches.length} validated matches`);
    return matches;

  } catch (error: any) {
    this.logger.error(`Error in findMediaMatchesNew: ${error.message}`);
    throw error;
  }
}


  private deduplicateMatches(matches: MediaMatchDto[]): MediaMatchDto[] {
    // Sort by confidence (highest first)
    const sortedMatches = matches.sort((a, b) => b.confidence - a.confidence);
    const deduplicated: MediaMatchDto[] = [];
    
    for (const match of sortedMatches) {
      // Check for overlaps with existing matches
      const overlappingMatch = deduplicated.find(existing => 
        this.timeRangesOverlap(
          existing.startTime,
          existing.endTime,
          match.startTime,
          match.endTime,
        )
      );
      
      if (!overlappingMatch) {
        // No overlap, add the match
        deduplicated.push(match);
      } else {
        // There's an overlap, keep the one with higher confidence
        if (match.confidence > overlappingMatch.confidence) {
          // Replace the existing match with the new one
          const index = deduplicated.indexOf(overlappingMatch);
          deduplicated[index] = match;
        }
        // Otherwise, keep the existing match (it has higher confidence)
      }
    }
    
    // Sort by start time for final output
    return deduplicated.sort((a, b) => a.startTime - b.startTime);
  }

  private timeRangesOverlap(
    start1: number,
    end1: number,
    start2: number,
    end2: number,
  ): boolean {
    return start1 < end2 && start2 < end1;
  }

  /**
   * Find the start time of when specific text occurs within word segments
   * @param matchedText The text to search for
   * @param words Array of word segments
   * @param segmentStartTime Start time of the segment containing the match
   * @param segmentEndTime End time of the segment containing the match
   * @returns The start time when the text occurs, or null if not found
   */
  private findTextOccurrenceTime(
    matchedText: string,
    words: WordSeg[],
    segmentStartTime: number,
    segmentEndTime: number
  ): number | null {
    if (!matchedText || !words || words.length === 0) {
      return null;
    }

    // Normalize the matched text for comparison
    const normalizedMatchedText = matchedText.toLowerCase().trim();
    
    // Get words within the segment time range
    const segmentWords = words.filter(word => 
      word.type === 'word' && 
      word.startTime >= segmentStartTime && 
      word.endTime <= segmentEndTime
    );

    if (segmentWords.length === 0) {
      return null;
    }

    // Try to find exact phrase match first
    const segmentText = segmentWords.map(w => w.text.toLowerCase()).join(' ');
    const matchIndex = segmentText.indexOf(normalizedMatchedText);
    
    if (matchIndex !== -1) {
      // Find which word corresponds to the start of the matched text
      let currentIndex = 0;
      for (const word of segmentWords) {
        const wordText = word.text.toLowerCase();
        if (currentIndex === matchIndex) {
          return word.startTime;
        }
        currentIndex += wordText.length + 1; // +1 for space
      }
    }

    // If exact phrase not found, try to find key words from the matched text
    const keywords = normalizedMatchedText
      .split(/\s+/)
      .filter(word => word.length > 2) // Filter out short words
      .slice(0, 3); // Take first 3 keywords

    for (const keyword of keywords) {
      const foundWord = segmentWords.find(word => 
        word.text.toLowerCase().includes(keyword)
      );
      if (foundWord) {
        return foundWord.startTime;
      }
    }

    // If no specific text found, return null to use original timing
    return null;
  }
}
