import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ProjectService } from '../../services/project.service';
import { BatchStartRequest, VideoInput } from '../../models/project.model';

@Component({
  selector: 'app-video-upload',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './video-upload.component.html',
  styleUrl: './video-upload.component.scss'
})
export class VideoUploadComponent implements OnInit {
  uploadForm!: FormGroup;
  isSubmitting = false;
  errorMessage = '';

  constructor(
    private fb: FormBuilder,
    private projectService: ProjectService,
    private router: Router
  ) {}

  ngOnInit() {
    this.initializeForm();
  }

  private initializeForm() {
    this.uploadForm = this.fb.group({
      language: ['en', Validators.required],
      templateName: ['Hormozi 2', Validators.required],
      webhookUrl: [''],
      magicZooms: [true],
      magicBrolls: [true],
      magicBrollsPercentage: [60, [Validators.min(0), Validators.max(100)]],
      dictionary: [''],
      videos: this.fb.array([this.createVideoGroup()])
    });
  }

  private createVideoGroup(): FormGroup {
    return this.fb.group({
      title: ['', Validators.required],
      videoUrl: [''],
      file: [null]
    });
  }

  get videosArray(): FormArray {
    return this.uploadForm.get('videos') as FormArray;
  }

  addVideo() {
    this.videosArray.push(this.createVideoGroup());
  }

  removeVideo(index: number) {
    if (this.videosArray.length > 1) {
      this.videosArray.removeAt(index);
    }
  }

  onFileSelected(event: Event, index: number) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (file) {
      const videoGroup = this.videosArray.at(index);
      videoGroup.patchValue({ file });
      
      // Auto-fill title if empty
      if (!videoGroup.get('title')?.value) {
        const fileName = file.name.replace(/\.[^/.]+$/, ''); // Remove extension
        videoGroup.patchValue({ title: fileName });
      }
    }
  }

  async onSubmit() {
    if (this.uploadForm.invalid) {
      this.markFormGroupTouched(this.uploadForm);
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';

    try {
      const formValue = this.uploadForm.value;
      
      // Prepare videos array
      const videos: VideoInput[] = formValue.videos.map((video: any) => ({
        title: video.title,
        videoUrl: video.videoUrl || undefined,
        file: video.file || undefined
      })).filter((video: VideoInput) => video.videoUrl || video.file);

      if (videos.length === 0) {
        this.errorMessage = 'Please provide at least one video URL or file.';
        this.isSubmitting = false;
        return;
      }

      const request: BatchStartRequest = {
        videos,
        language: formValue.language,
        templateName: formValue.templateName,
        webhookUrl: formValue.webhookUrl || undefined,
        magicZooms: formValue.magicZooms,
        magicBrolls: formValue.magicBrolls,
        magicBrollsPercentage: formValue.magicBrollsPercentage,
        dictionary: formValue.dictionary || undefined
      };

      console.log("Request: ", request);

      const response = await this.projectService.startBatchProcessing(request).toPromise();
      console.log('RESPONSE IS: ', response);
      if (response?.batchId && response?.projectIds?.length > 0) {
        this.router.navigate(['/batch-success', response.batchId]);
      } else {
        this.errorMessage = 'Failed to start batch processing. Please try again.';
      }
    } catch (error: any) {
      console.error('Batch processing error:', error);
      this.errorMessage = error.error?.error || 'An error occurred while processing your request.';
    } finally {
      this.isSubmitting = false;
    }
  }

  private markFormGroupTouched(formGroup: FormGroup) {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      } else if (control instanceof FormArray) {
        control.controls.forEach(arrayControl => {
          if (arrayControl instanceof FormGroup) {
            this.markFormGroupTouched(arrayControl);
          } else {
            arrayControl.markAsTouched();
          }
        });
      } else {
        control?.markAsTouched();
      }
    });
  }

  isFieldInvalid(fieldName: string, index?: number): boolean {
    if (index !== undefined) {
      const videoGroup = this.videosArray.at(index);
      const field = videoGroup.get(fieldName);
      return !!(field?.invalid && field?.touched);
    }
    
    const field = this.uploadForm.get(fieldName);
    return !!(field?.invalid && field?.touched);
  }

  getFieldError(fieldName: string, index?: number): string {
    if (index !== undefined) {
      const videoGroup = this.videosArray.at(index);
      const field = videoGroup.get(fieldName);
      if (field?.errors?.['required']) return `${fieldName} is required`;
      return '';
    }
    
    const field = this.uploadForm.get(fieldName);
    if (field?.errors?.['required']) return `${fieldName} is required`;
    if (field?.errors?.['min']) return `Value must be at least ${field.errors['min'].min}`;
    if (field?.errors?.['max']) return `Value must be at most ${field.errors['max'].max}`;
    return '';
  }
}