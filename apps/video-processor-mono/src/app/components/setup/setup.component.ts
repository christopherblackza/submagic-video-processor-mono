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
  uploading = false;
  error = '';
  successMessage = '';
  templates: string[] = [];
  selectedFiles: File[] = [];
  dragActive = false;

  constructor(private fb: FormBuilder, private projectService: ProjectService, private router: Router) {

    this.setupForm = this.fb.group({ apiKey: ['', Validators.required], openAiApiKey: ['', Validators.required] });

    this.loadApiKey();
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
      await this.projectService.saveApiKey(apiKey).toPromise();
      this.successMessage = 'API key saved';
    } catch (e: any) {
      this.error = e?.error?.message || e?.message || 'Failed to connect. Check API key.';
    } finally {
      this.connecting = false;
    }
  }

  onFileSelected(event: Event) {
    const target = event.target as HTMLInputElement;
    const files = target.files;
    if (files) {
      this.selectedFiles = Array.from(files);
      // Optional: store selected names
    }
  }

  async uploadMedia(event?: Event) {
    if (event) event.preventDefault();
    if (this.selectedFiles.length === 0) {
      this.error = 'Please select at least one file.';
      return;
    }
    this.uploading = true;
    this.error = '';
    this.successMessage = '';
    try {
      const res = await this.projectService.uploadMediaFiles(this.selectedFiles).toPromise();
      console.log('res', res)
      this.successMessage = 'Files uploaded successfully';

      this.selectedFiles = [];
      const input = document.getElementById('file-input') as HTMLInputElement | null;
      if (input) input.value = '';
    } catch (e: any) {
      this.error = e?.error?.message || e?.message || 'Failed to upload files.';
    } finally {
      this.uploading = false;
    }
  }


  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.dragActive = true;
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    this.dragActive = false;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.dragActive = false;
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.selectedFiles = [...this.selectedFiles, ...Array.from(files)];
    }
  }

  openFileDialog() {
    const input = document.getElementById('file-input') as HTMLInputElement | null;
    if (input) input.click();
  }

  removeFile(index: number) {
    this.selectedFiles.splice(index, 1);
  }

  clearFiles() {
    this.selectedFiles = [];
    const input = document.getElementById('file-input') as HTMLInputElement | null;
    if (input) input.value = '';
  }

  async loadApiKey() {
      const resp = await this.projectService.loadApiKey().toPromise();
      console.log('resp', resp);

      this.setupForm.patchValue({ apiKey: resp.apiKey });

      const openAiApiKeyResp = await this.projectService.loadOpenAiApiKey().toPromise();
      console.log('openAiApiKeyResp', openAiApiKeyResp);

      this.setupForm.patchValue({ openAiApiKey: openAiApiKeyResp.apiKey });
  }

  async proceedToUpload() {
    if (this.setupForm.invalid) {
      this.setupForm.markAllAsTouched();
      return;
    }
    this.connecting = true;
    this.error = '';
    const apiKey = this.setupForm.value.apiKey as string;
    const openAiApiKey = this.setupForm.value.openAiApiKey as string;

    try {
      await this.projectService.saveApiKey(apiKey).toPromise();
      await this.projectService.saveOpenAiApiKey(openAiApiKey).toPromise();
      this.router.navigate(['/upload']);
    } catch (e: any) {
      this.error = e?.error?.message || e?.message || 'Failed to save API key.';
    } finally {
      this.connecting = false;
    }
  }
}
