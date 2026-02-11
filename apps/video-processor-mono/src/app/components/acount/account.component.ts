import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup } from "@angular/forms";
import { Router } from "@angular/router";
import { ProjectService } from "../../services/project.service";
import { ApiKeyService } from "../../services/api-key.service";
import { AuthService } from "../../services/auth.service";
import { ApiKey } from "../../models/api-key.model";

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

  error = "";
  successMessage = "";
  
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
  }

  loadUserEmail() {
    this.authService.currentUser$.subscribe(user => {
      this.userEmail = user?.email || null;
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

  proceedToNext() {
    if (!this.openaiKey) {
      this.error = "OpenAI API Key is required to proceed.";
      return;
    }
    this.router.navigate(["/upload"]);
  }
  
  goToMediaLibrary() {
    this.router.navigate(['/media-library']);
  }
}
