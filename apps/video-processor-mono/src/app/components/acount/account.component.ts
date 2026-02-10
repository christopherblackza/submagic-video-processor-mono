import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup } from "@angular/forms";
import { Router } from "@angular/router";
import { ProjectService } from "../../services/project.service";
import { ApiKeyService } from "../../services/api-key.service";
import { AuthService } from "../../services/auth.service";
import { ApiKey } from "../../models/api-key.model";
import { UserMediaItem } from "../../models/project.model";

@Component({
  selector: "app-account",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: "./account.component.html",
  styleUrl: "./account.component.scss",
})
export class AccountComponent implements OnInit {
  openaiForm!: FormGroup;
  submagicForm!: FormGroup;
  
  apiKeys: ApiKey[] = [];
  loadingKeys = false;
  
  openaiKey?: ApiKey;
  submagicKey?: ApiKey;
  userEmail: string | null = null;

  userMediaItems: UserMediaItem[] = [];
  loadingMedia = false;

  uploading = false;
  error = "";
  successMessage = "";
  
  selectedFiles: File[] = [];
  dragActive = false;

  constructor(
    private fb: FormBuilder,
    private projectService: ProjectService,
    private apiKeyService: ApiKeyService,
    private authService: AuthService,
    private router: Router
  ) {
    this.openaiForm = this.fb.group({
      keyValue: ["", Validators.required],
    });
    this.submagicForm = this.fb.group({
      keyValue: ["", Validators.required],
    });
  }

  ngOnInit() {
    this.loadApiKeys();
    this.loadUserEmail();
    this.loadUserMedia();
  }

  loadUserEmail() {
    this.authService.currentUser$.subscribe(user => {
      this.userEmail = user?.email || null;
    });
  }

  loadUserMedia() {
    this.loadingMedia = true;
    this.projectService.getUserMediaItems().subscribe({
      next: (items) => {
        this.userMediaItems = items;
        this.loadingMedia = false;
      },
      error: (err) => {
        console.error("Failed to load user media", err);
        this.loadingMedia = false;
      }
    });
  }

  back() {
    this.router.navigate(['/dashboard']);
  }

  loadApiKeys() {
    this.loadingKeys = true;
    this.apiKeyService.getApiKeys().subscribe({
      next: (keys) => {
        this.apiKeys = keys;
        this.openaiKey = keys.find(k => k.key_name === 'openai');
        this.submagicKey = keys.find(k => k.key_name === 'submagic');
        this.loadingKeys = false;
      },
      error: (err) => {
        this.error = "Failed to load API keys";
        this.loadingKeys = false;
      }
    });
  }

  saveKey(name: 'openai' | 'submagic') {
    const form = name === 'openai' ? this.openaiForm : this.submagicForm;
    if (form.invalid) {
      form.markAllAsTouched();
      return;
    }

    const keyValue = form.value.keyValue;
    const existingKey = name === 'openai' ? this.openaiKey : this.submagicKey;

    if (existingKey) {
      // Rotate
      this.apiKeyService.rotateApiKey(existingKey.id, keyValue).subscribe({
        next: (updatedKey) => {
          this.updateLocalKey(updatedKey);
          form.reset();
          this.showSuccess(`${name} key updated successfully`);
        },
        error: (err) => this.showError(err)
      });
    } else {
      // Create
      this.apiKeyService.createApiKey(name, keyValue).subscribe({
        next: (newKey) => {
          this.apiKeys.push(newKey);
          this.updateLocalKey(newKey);
          form.reset();
          this.showSuccess(`${name} key saved successfully`);
        },
        error: (err) => this.showError(err)
      });
    }
  }

  deleteKey(name: 'openai' | 'submagic') {
    const key = name === 'openai' ? this.openaiKey : this.submagicKey;
    if (!key) return;
    if (!confirm(`Are you sure you want to delete the ${name} key?`)) return;

    this.apiKeyService.deleteApiKey(key.id).subscribe({
      next: () => {
        this.apiKeys = this.apiKeys.filter(k => k.id !== key.id);
        if (name === 'openai') this.openaiKey = undefined;
        if (name === 'submagic') this.submagicKey = undefined;
        this.showSuccess(`${name} key deleted`);
      },
      error: (err) => this.showError(err)
    });
  }

  private updateLocalKey(key: ApiKey) {
    if (key.key_name === 'openai') this.openaiKey = key;
    if (key.key_name === 'submagic') this.submagicKey = key;
    
    const idx = this.apiKeys.findIndex(k => k.id === key.id);
    if (idx >= 0) {
      this.apiKeys[idx] = key;
    } else {
      // If it wasn't in the list (rare race condition if added elsewhere), push it
      this.apiKeys.push(key);
    }
  }

  showSuccess(msg: string) {
    this.successMessage = msg;
    setTimeout(() => this.successMessage = "", 3000);
  }

  showError(err: any) {
    this.error = err?.error?.message || err?.message || "An error occurred";
    setTimeout(() => this.error = "", 5000);
  }

  // File Upload Logic
  onFileSelected(event: Event) {
    const target = event.target as HTMLInputElement;
    const files = target.files;
    if (files) {
      this.selectedFiles = Array.from(files);
    }
  }

  async uploadMedia(event?: Event) {
    if (event) event.preventDefault();
    if (this.selectedFiles.length === 0) {
      this.error = "Please select at least one file.";
      return;
    }
    this.uploading = true;
    this.error = "";
    this.successMessage = "";
    
    try {
      await this.projectService.uploadMediaFiles(this.selectedFiles).toPromise();
      this.successMessage = "Files uploaded successfully";
      this.selectedFiles = [];
      const input = document.getElementById("file-input") as HTMLInputElement | null;
      if (input) input.value = "";
      this.loadUserMedia();
    } catch (e: any) {
      this.error = e?.error?.message || e?.message || "Failed to upload files.";
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
    const input = document.getElementById("file-input") as HTMLInputElement | null;
    if (input) input.click();
  }

  removeFile(index: number) {
    this.selectedFiles.splice(index, 1);
  }

  clearFiles() {
    this.selectedFiles = [];
    const input = document.getElementById("file-input") as HTMLInputElement | null;
    if (input) input.value = "";
  }

  proceedToNext() {
    if (!this.openaiKey) {
      this.error = "OpenAI API Key is required to proceed.";
      return;
    }
    // Submagic key might be optional or required, assuming optional for now or add check if needed
    // if (!this.submagicKey) { ... }
    
    this.router.navigate(["/upload"]);
  }


}
