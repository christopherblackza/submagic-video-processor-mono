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
      // Append new files instead of replacing
      const newFiles = Array.from(files);
      // Filter out duplicates based on name and size
      const uniqueNewFiles = newFiles.filter(newFile => 
        !this.selectedFiles.some(existing => 
          existing.name === newFile.name && existing.size === newFile.size
        )
      );
      
      this.selectedFiles = [...this.selectedFiles, ...uniqueNewFiles];
      this.uploadForm.patchValue({ files: this.selectedFiles });
      
      // Reset input value to allow selecting the same file again if needed (though we filter duplicates)
      target.value = '';
    }
  }

  removeFile(index: number) {
    this.selectedFiles.splice(index, 1);
    this.uploadForm.patchValue({ files: this.selectedFiles });
    
    // If no files left, mark as untouched or handle validation if needed
    if (this.selectedFiles.length === 0) {
      this.uploadForm.get('files')?.setErrors({ required: true });
    }
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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