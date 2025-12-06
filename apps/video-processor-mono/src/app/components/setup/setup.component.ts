import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { ProjectService } from '../../services/project.service';

@Component({
  selector: 'app-setup',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './setup.component.html',
  styleUrl: './setup.component.scss'
})
export class SetupComponent {
    setupForm!: FormGroup;
  
  connecting = false;
  error = '';
  templates: string[] = [];

  constructor(private fb: FormBuilder, private projectService: ProjectService, private router: Router) {

    this.setupForm = this.fb.group({ apiKey: ['', Validators.required] });

    const saved = localStorage.getItem('submagic_api_key');
    if (saved) this.setupForm.patchValue({ apiKey: saved });
    const savedTemplates = localStorage.getItem('submagic_templates');
    if (savedTemplates) this.templates = JSON.parse(savedTemplates);
  }

  async onConnect() {
    if (this.setupForm.invalid) {
      this.setupForm.markAllAsTouched();
      return;
    }
    this.connecting = true;
    this.error = '';
    const apiKey = this.setupForm.value.apiKey as string;
    try {
      localStorage.setItem('submagic_api_key', apiKey);
      const res = await this.projectService.getTemplates().toPromise();
      this.templates = res?.templates || [];
      localStorage.setItem('submagic_templates', JSON.stringify(this.templates));
    } catch (e: any) {
      this.error = e?.error?.message || e?.message || 'Failed to connect. Check API key.';
    } finally {
      this.connecting = false;
    }
  }

  proceedToUpload() {
    this.router.navigate(['/upload']);
  }
}

