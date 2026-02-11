import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { environment } from 'apps/video-processor-mono/src/environments/environment';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  form!: FormGroup;
  error = '';
  loading = false;
  isSignUp = false;

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {

    if (environment.production) {
      this.form = this.fb.group({
        email: ['', [Validators.required, Validators.email]],
        password: ['', [Validators.required, Validators.minLength(6)]]
      });
    } else {
      this.form = this.fb.group({
        email: ['christopher.black.sa@gmail.com', [Validators.required, Validators.email]],
        password: ['JesusFreak25*', [Validators.required, Validators.minLength(6)]]
      });
    }
  }

  toggleMode() {
    this.isSignUp = !this.isSignUp;
    this.error = '';
    this.form.reset();
  }

  async onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading = true;
    this.error = '';
    const { email, password } = this.form.value;
    
    try {
      const { error } = this.isSignUp 
        ? await this.auth.signUp(email, password)
        : await this.auth.login(email, password);

      if (error) {
        this.error = error.message;
        return;
      }

      if (this.isSignUp) {
         this.error = 'Registration successful! Please check your email for confirmation.';
         // Don't redirect immediately on signup if email confirmation is required, 
         // but for now we'll assume it might be auto-confirmed or they can login.
         // Actually, let's just stay here and ask them to check email.
      } else {
        const redirect = this.route.snapshot.queryParamMap.get('redirect') || '/dashboard';
        this.router.navigateByUrl(redirect);
      }
    } catch (e) {
      this.error = 'An unexpected error occurred';
    } finally {
      this.loading = false;
    }
  }

  async loginWithProvider(provider: 'google' | 'github' | 'twitter') {
    this.loading = true;
    this.error = '';
    try {
      const { error } = await this.auth.signInWithProvider(provider);
      if (error) this.error = error.message;
    } catch (e) {
      this.error = 'An unexpected error occurred';
    } finally {
      this.loading = false;
    }
  }
}
