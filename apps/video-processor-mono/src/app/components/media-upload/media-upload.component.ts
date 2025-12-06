import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ProjectService } from '../../services/project.service';

@Component({
  selector: 'app-media-upload',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './media-upload.component.html',
  styleUrls: ['./media-upload.component.scss']
})
export class MediaUploadComponent implements OnInit {
  uploadForm!: FormGroup;
  isSubmitting = false;
  errorMessage = '';
  successMessage = '';
  selectedFiles: File[] = [];

  constructor(
    private fb: FormBuilder,
    private projectService: ProjectService,
    private router: Router
  ) {}

  ngOnInit() {
    this.uploadForm = this.fb.group({
      files: [null, Validators.required]
    });
  }

  onFileSelected(event: Event) {
    const target = event.target as HTMLInputElement;
    const files = target.files;
    if (files) {
      this.selectedFiles = Array.from(files);
      this.uploadForm.patchValue({ files: this.selectedFiles });
    }
  }

  async onSubmit() {
    if (this.uploadForm.invalid) {
      this.uploadForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';
    this.successMessage = '';

    if (this.selectedFiles.length === 0) {
      this.errorMessage = 'Please select at least one file.';
      this.isSubmitting = false;
      return;
    }

    try {
      const response = await this.projectService.uploadMediaFiles(this.selectedFiles).toPromise();
      this.successMessage = 'Files uploaded successfully!';
      console.log('Upload response:', response);
      this.uploadForm.reset();
      this.selectedFiles = [];

    } catch (error: any) {
      console.error('Upload error:', error);
      this.errorMessage = error.error?.error || 'An error occurred while uploading files.';
    } finally {
      this.isSubmitting = false;
    }
  }

  isFieldInvalid(): boolean {
    const control = this.uploadForm.get('files');
    return !!(control?.invalid && control?.touched);
  }
}