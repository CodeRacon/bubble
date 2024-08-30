import { Component, inject, OnDestroy } from '@angular/core';
import { ReactiveFormsModule, FormControl, FormGroup, FormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { UsersService } from '../../utils/services/user.service';
import { emailValidator, passwordValidator } from '../../utils/form-validators';
import { getAuth, GoogleAuthProvider, signInWithPopup } from '@angular/fire/auth';
import { addDoc, collection, Firestore, getDocs, query, serverTimestamp, where } from '@angular/fire/firestore';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    RouterModule,
    FormsModule,
    ReactiveFormsModule
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent implements OnDestroy {

  public userservice = inject(UsersService);
  private firestore = inject(Firestore);
  private userlogin: any;
  private router: Router = inject(Router);

  public errorEmail = '';
  public errorPassword = '';
  public logginIn = false;

  loginForm = new FormGroup({
    email: new FormControl('', [
      Validators.required,
      emailValidator(),
    ]),
    password: new FormControl('', [
      Validators.required,
      passwordValidator(),
    ]),
  });


  ngOnDestroy(): void {
    if (this.userlogin) this.userlogin.unsubscribe();
  }


  async submitLoginForm(event: Event) {
    event.preventDefault();
    this.logginIn = true;
    this.loginForm.disable();
    this.clearAllErrorSpans();
    const email = this.loginForm.value.email || '';
    const password = this.loginForm.value.password || '';
    const error = await this.userservice.loginUser(email, password);
    this.logginIn = false;
    this.loginForm.enable();
    if (error != '') this.handleLoginErrors(error);
    else this.handleLoginSuccess();
  }


  async signinWithGoogle() {
    this.logginIn = true;
    const error = await this.signinWithGooglePopup();
    this.logginIn = false;
    if (error != '') this.handleLoginErrors(error);
    else this.handleLoginSuccess();
  }


  async signinWithGooglePopup(): Promise<string> {
    try {
      const provider = new GoogleAuthProvider();
      const auth = getAuth();
      auth.languageCode = 'de';
      const result = await signInWithPopup(auth, provider);
      if (result.user.displayName && result.user.email) {
        this.addGoogleUserToFirestore(result.user.displayName, result.user.email, result.user.photoURL);
      }
      return '';
    } catch (error) {
      console.error('googlesignin: ', (error as Error).message);
      return (error as Error).message;
    }
  }


  private async addGoogleUserToFirestore(name: string, email: string, pictureURL: string | null): Promise<string> {
    const userObj = {
      name: name,
      email: email,
      provider: 'google',
      online: false,
      signupAt: serverTimestamp(),
      avatar: 0,
      pictureURL: pictureURL || null,
    };
    let ref = collection(this.firestore, '/users');
    let userID = await this.getUserIDByEmail(email);
    if (userID) return userID;
    let newUser = await addDoc(ref, userObj);
    setTimeout(() => {
      this.userservice.subscribeCurrentUserByID(newUser.id);
    }, 500);
    return newUser.id;
  }


  private async getUserIDByEmail(email: string | null): Promise<string | undefined> {
    const usersRef = collection(this.firestore, '/users');
    const queryresponse = query(usersRef, where('email', '==', email));
    const querySnapshot = await getDocs(queryresponse);
    if (!querySnapshot.empty) { const userDoc = querySnapshot.docs[0]; return userDoc.id; }
    return undefined;
  }


  handleLoginSuccess() {
    if (this.userservice.currentUser) this.router.navigate(['/chatcontent']);
    else {
      this.userlogin = this.userservice.changeCurrentUser$.subscribe((change) => {
        if (change == 'currentUserSignin') this.router.navigate(['/chatcontent']);
      });
    }
  }


  handleLoginErrors(error: string) {
    if (error.includes('auth/user-not-found')) {
      this.errorEmail = 'Diese E-Mail-Adresse ist leider ungültig.';
    } else if (error.includes('auth/wrong-password')) {
      this.errorPassword = 'Falsches Passwort oder E-Mail. Bitte noch einmal versuchen.';
    }
  }


  clearAllErrorSpans() {
    this.errorEmail = '';
    this.errorPassword = '';
  }

}
