import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Session } from './session.service';

@Component({
  selector: 'app-sign-in',
  imports: [ReactiveFormsModule],
  templateUrl: './sign-in.component.html',
})
export class SignInComponent {
  private readonly forms = inject(FormBuilder);
  private readonly session = inject(Session);
  private readonly router = inject(Router);
  readonly error = signal('');

  readonly form = this.forms.nonNullable.group({
    email: ['ananya@asha.demo', Validators.required],
    password: ['umbral', Validators.required],
  });

  submit(): void {
    if (this.form.invalid) {
      return;
    }
    const { email, password } = this.form.getRawValue();
    void this.session.enter(email, password).then((failure) => {
      if (failure) {
        this.error.set(failure);
        return;
      }
      void this.router.navigateByUrl('/desk');
    });
  }

  use(email: string): void {
    this.form.setValue({ email, password: 'umbral' });
    this.error.set('');
  }
}
