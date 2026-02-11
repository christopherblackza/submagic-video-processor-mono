import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-system-prompt',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './system-prompt.component.html',
  styleUrl: './system-prompt.component.scss'
})
export class SystemPromptComponent {
  promptForm: FormGroup;
  saving = false;
  saved = false;

  constructor(private fb: FormBuilder, private router: Router) {

    const defaultPrompt = `You are matching narration segments to b-roll footage.
Return ONLY: {"matches":[{userMediaId,startTime,endTime,confidence,reason,matchedText}]}

Rules:
- Place the FIRST engagement match in the 2.5s–6.0s window (mandatory).
- Never place media before 2.5s.
- Use each userMediaId at most once (one media per segment).
- Each placement must be <= 4.0 seconds long and lie within the segment window.
- Use literal, visual cues (actions/objects/moods). Include the trigger text in matchedText.
- Consider both the description AND tags when matching — tags represent key themes and concepts.
- Match based on semantic relevance, emotions, actions, and thematic alignment`;



    const existing = localStorage.getItem('submagic_system_prompt');
    this.promptForm = this.fb.group({
      systemPrompt: [existing ? existing : defaultPrompt]
    });

  }

  save() {
    this.saving = true;
    this.saved = false;
    const value = this.promptForm.value.systemPrompt || '';
    localStorage.setItem('submagic_system_prompt', value);
    
    // Simulate a brief delay for better UX
    setTimeout(() => {
      this.saving = false;
      this.saved = true;
      this.promptForm.markAsPristine(); // Disable button until next change
    }, 500);
  }

  onChange() {
    if (this.promptForm.pristine) {
      this.promptForm.markAsDirty();
    }
  }

  goToUpload() {
    this.router.navigate(['/dashboard']);
  }
}

