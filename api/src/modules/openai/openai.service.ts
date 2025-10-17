import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { SubmagicService } from '../submagic/submagic.service';
import {
  MediaMatchingRequestDto,
  MediaMatchingResponseDto,
  MediaMatchDto,
  MediaItemDto,
} from '../../common/dto/media-matching.dto';

// Local interface definition
interface TextSegment {
  text: string;
  startTime: number;
  endTime: number;
  words: WordSegment[];
}

interface WordSegment {
  id: string;
  text: string;
  startTime: number;
  endTime: number;
  type: string;
}

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
      const textSegments = this.extractMeaningfulSegments(projectData.words);
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

      // Find media matches using original algorithm
      const matches = await this.findMediaMatches(
        textSegments,
        request.mediaItems,
        request.confidenceThreshold || 0.7,
      );

      // Deduplicate and sort matches
      const finalMatches = this.deduplicateMatches(matches);
      this.logger.log(`Found ${finalMatches.length} matches`);

      return {
        projectId: request.projectId,
        matches: finalMatches,
        totalMatches: finalMatches.length,
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
    projectId: string,
    mediaItems: MediaItemDto[],
    confidenceThreshold?: number,
  ): Promise<any> {
    try {
      this.logger.log(
        `Starting analyze and update for project ${projectId} with ${mediaItems.length} media items`,
      );

      // First, analyze the project for media matches
      const analysisResult = await this.analyzeProjectForMediaMatching({
        projectId,
        mediaItems,
        confidenceThreshold: confidenceThreshold || 0.7,
      });

      this.logger.log(
        `Analysis completed. Found ${analysisResult.totalMatches} matches`,
      );

      // If matches were found, update the project
      if (analysisResult.matches.length > 0) {
        const updateResult = await this.updateProjectWithMatches(
          projectId,
          analysisResult.matches,
        );

        return {
          analysis: analysisResult,
          update: updateResult,
        };
      } else {
        this.logger.log(`No matches found for project ${projectId}`);
        return {
          analysis: analysisResult,
          update: null,
        };
      }
    } catch (error) {
      this.logger.error(
        `Error in analyze and update project: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Failed to analyze and update project',
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
      this.logger.error(
        `Error updating project with matches: ${error.message}`,
        error.stack,
      );
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

  private extractMeaningfulSegments(words: WordSegment[]): TextSegment[] {
    const segments: TextSegment[] = [];
    let currentSegment: WordSegment[] = [];
    let currentText = '';

    // Common filler words to ignore
    const ignoreWords = new Set(['um', 'uh', 'like', 'you know', 'so', 'well']);

    for (const word of words) {
      // Skip silence and punctuation-only entries
      if (word.type === 'silence' || !word.text?.trim()) {
        continue;
      }

      // Skip common filler words
      if (ignoreWords.has(word.text.toLowerCase().trim())) {
        continue;
      }

      currentSegment.push(word);
      currentText += (currentText ? ' ' : '') + word.text;

      // Create segment on punctuation or when we have enough content
      if (
        word.text.includes('.') ||
        word.text.includes('!') ||
        word.text.includes('?') ||
        currentSegment.length >= 10
      ) {
        if (currentSegment.length >= 2) {
          // Only include phrases with at least 2 words
          segments.push({
            text: currentText.trim(),
            startTime: currentSegment[0].startTime,
            endTime: currentSegment[currentSegment.length - 1].endTime,
            words: [...currentSegment],
          });
        }

        currentSegment = [];
        currentText = '';
      }
    }

    // Add remaining segment if it has enough content
    if (currentSegment.length >= 2) {
      segments.push({
        text: currentText.trim(),
        startTime: currentSegment[0].startTime,
        endTime: currentSegment[currentSegment.length - 1].endTime,
        words: [...currentSegment],
      });
    }

    return segments;
  }

  private async findMediaMatches(
    textSegments: TextSegment[],
    mediaItems: MediaItemDto[],
    confidenceThreshold: number,
  ): Promise<MediaMatchDto[]> {
    const matches: MediaMatchDto[] = [];

    try {
      // Build the system prompt
      const systemPrompt = this.buildSystemPrompt(
        mediaItems,
        confidenceThreshold,
      );

      // Process segments in batches to avoid token limits
      const batchSize = 5;
      for (let i = 0; i < textSegments.length; i += batchSize) {
        const batch = textSegments.slice(i, i + batchSize);
        const batchText = batch
          .map(
            (segment, index) =>
              `Segment ${i + index + 1} (${segment.startTime}s - ${segment.endTime}s): "${segment.text}"`,
          )
          .join('\n\n');

        const response = await this.openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            {
              role: 'user',
              content: `Analyze these text segments and find media matches:\n\n${batchText}`,
            },
          ],
          temperature: 0.3,
          max_tokens: 2000,
        });

        const responseContent = response.choices[0].message.content;
        if (!responseContent) {
          this.logger.warn('OpenAI response content is null, skipping batch');
          continue;
        }

        const batchMatches = this.parseOpenAIResponse(responseContent, batch);
        matches.push(...batchMatches);
      }

      return matches;
    } catch (error) {
      this.logger.error(
        `Error finding media matches with OpenAI: ${error.message}`,
      );
      throw new InternalServerErrorException(
        'Failed to analyze text with OpenAI',
      );
    }
  }

  private buildSystemPrompt(
    mediaItems: MediaItemDto[],
    confidenceThreshold: number,
  ): string {
    const mediaList = mediaItems
      .map(
        (item) => `- ${item.userMediaId}: ${item.description}`,
      )
      .join('\n');

    return `You are an AI assistant that analyzes video transcripts to find relevant media matches.

Available Media Items:
${mediaList}

Your task is to analyze text segments from a video transcript and identify which media items would be most relevant to display during each segment.

Guidelines:
- Only suggest matches with confidence >= ${confidenceThreshold}
- Consider semantic relevance, not just keyword matching
- A single media item can match multiple segments if relevant
- Focus on the main topics and themes in each segment
- Provide a brief reason for each match

Response format (JSON only):
{
  "matches": [
    {
      "userMediaId": "media-id",
      "startTime": 123.45,
      "endTime": 234.56,
      "confidence": 0.85,
      "reason": "Brief explanation of why this media matches",
      "matchedText": "The specific text that triggered this match"
    }
  ]
}`;
  }

  private parseOpenAIResponse(
    response: string,
    segments: TextSegment[],
  ): MediaMatchDto[] {
    try {
      // Extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        this.logger.warn('No JSON found in OpenAI response');
        return [];
      }

      const parsed = JSON.parse(jsonMatch[0]);
      const matches: MediaMatchDto[] = [];

      if (parsed.matches && Array.isArray(parsed.matches)) {
        for (const match of parsed.matches) {
          // Validate the match has required fields
          if (
            match.userMediaId &&
            typeof match.startTime === 'number' &&
            typeof match.endTime === 'number' &&
            typeof match.confidence === 'number'
          ) {
            matches.push({
              userMediaId: match.userMediaId,
              startTime: match.startTime,
              endTime: match.endTime,
              confidence: match.confidence,
              reason: match.reason || 'AI-generated match',
              matchedText: match.matchedText || '',
            });
          }
        }
      }

      return matches;
    } catch (error) {
      this.logger.error(`Error parsing OpenAI response: ${error.message}`);
      return [];
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
}
