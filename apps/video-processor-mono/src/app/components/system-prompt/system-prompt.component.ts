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
    const existing = localStorage.getItem('submagic_system_prompt') || '';
    this.promptForm = this.fb.group({
      systemPrompt: [existing]
    });
  }

  save() {
    this.saving = true;
    this.saved = false;
    const value = this.promptForm.value.systemPrompt || '';
    localStorage.setItem('submagic_system_prompt', value);
    this.saving = false;
    this.saved = true;
  }

  goToUpload() {
    this.router.navigate(['/upload']);
  }
}

