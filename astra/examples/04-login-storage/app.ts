import { signal, effect } from '../../packages/reactive/src/index.ts';
import { AuthService, DUMMY_USERS } from './auth.service.ts';
import { LoginComponent } from './login.component.ts';

const authService = new AuthService();
const loginComponent = new LoginComponent(authService);

const emailInput = document.getElementById('email-input') as HTMLInputElement | null;
const passwordInput = document.getElementById('password-input') as HTMLInputElement | null;
const rememberMeInput = document.getElementById('remember-me') as HTMLInputElement | null;
const btnSubmit = document.getElementById('btn-submit') as HTMLButtonElement | null;
const btnSpinner = document.getElementById('btn-spinner') as HTMLElement | null;
const btnLabel = document.getElementById('btn-label') as HTMLElement | null;
const dummyProfilesContainer = document.getElementById('dummy-profiles') as HTMLElement | null;
const notificationBox = document.getElementById('notification-box') as HTMLElement | null;
const sessionCard = document.getElementById('session-card') as HTMLElement | null;
const sessionDetails = document.getElementById('session-details') as HTMLElement | null;
const sessionJson = document.getElementById('session-json') as HTMLElement | null;
const btnLogout = document.getElementById('btn-logout') as HTMLButtonElement | null;
const btnClear = document.getElementById('btn-clear') as HTMLButtonElement | null;

if (dummyProfilesContainer) {
  dummyProfilesContainer.innerHTML = '';
  DUMMY_USERS.forEach((u) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'flex flex-col items-start p-2 rounded-lg bg-slate-950 border border-slate-800 hover:border-cyan-500/50 hover:bg-slate-800/50 transition-all text-left';
    btn.innerHTML = '<div class="flex items-center gap-1.5 w-full"><span class="w-1.5 h-1.5 rounded-full bg-cyan-400"></span><span class="text-[11px] font-semibold text-white truncate">' + u.name + '</span></div><span class="text-[10px] text-slate-400 truncate w-full">' + u.role + '</span>';
    btn.addEventListener('click', () => {
      loginComponent.fillDummy(u.email, u.password);
      if (emailInput) emailInput.value = u.email;
      if (passwordInput) passwordInput.value = u.password;
    });
    dummyProfilesContainer.appendChild(btn);
  });
}

if (emailInput) {
  emailInput.value = loginComponent.emailControl.value();
  emailInput.addEventListener('input', (e) => {
    loginComponent.emailControl.setValue((e.target as HTMLInputElement).value);
  });
}

if (passwordInput) {
  passwordInput.value = loginComponent.passwordControl.value();
  passwordInput.addEventListener('input', (e) => {
    loginComponent.passwordControl.setValue((e.target as HTMLInputElement).value);
  });
}

if (rememberMeInput) {
  rememberMeInput.checked = loginComponent.rememberMe();
  rememberMeInput.addEventListener('change', (e) => {
    loginComponent.rememberMe.set((e.target as HTMLInputElement).checked);
  });
}

if (btnSubmit) {
  btnSubmit.addEventListener('click', async () => {
    await loginComponent.handleLogin();
  });
}

if (btnLogout) {
  btnLogout.addEventListener('click', () => {
    loginComponent.handleLogout();
  });
}

if (btnClear) {
  btnClear.addEventListener('click', () => {
    authService.clearLocalStorage();
    loginComponent.errorMessage.set('LocalStorage purged completely.');
  });
}

effect(() => {
  const loading = loginComponent.isLoading();
  if (btnSpinner && btnLabel && btnSubmit) {
    if (loading) {
      btnSpinner.classList.remove('hidden');
      btnLabel.textContent = 'Authenticating...';
      btnSubmit.disabled = true;
    } else {
      btnSpinner.classList.add('hidden');
      btnLabel.textContent = 'Authenticate & Store';
      btnSubmit.disabled = false;
    }
  }
});

effect(() => {
  const err = loginComponent.errorMessage();
  const succ = loginComponent.successMessage();
  if (!notificationBox) return;

  if (err) {
    notificationBox.className = 'rounded-lg p-3 text-xs font-medium border bg-rose-500/10 border-rose-500/30 text-rose-300 block';
    notificationBox.textContent = err;
  } else if (succ) {
    notificationBox.className = 'rounded-lg p-3 text-xs font-medium border bg-emerald-500/10 border-emerald-500/30 text-emerald-300 block';
    notificationBox.textContent = succ;
  } else {
    notificationBox.className = 'hidden';
    notificationBox.textContent = '';
  }
});

effect(() => {
  const isAuth = authService.isAuthenticated();
  const session = authService.sessionInfo();
  const user = authService.currentUser();

  if (sessionCard && sessionDetails && sessionJson) {
    if (isAuth && session && user) {
      sessionCard.classList.remove('hidden');
      sessionDetails.innerHTML = '<img src="' + user.avatar + '" alt="' + user.name + '" class="w-10 h-10 rounded-full border border-cyan-400/40 object-cover" /><div><div class="text-xs font-bold text-white flex items-center gap-1.5"><span>' + user.name + '</span><span class="px-1.5 py-0.5 rounded text-[10px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-medium">' + user.role + '</span></div><div class="text-[11px] text-slate-400 font-mono">' + user.email + '</div><div class="text-[10px] text-slate-500">Login: ' + new Date(session.loginTime).toLocaleTimeString() + '</div></div>';
      sessionJson.textContent = JSON.stringify(session, null, 2);
    } else {
      sessionCard.classList.add('hidden');
      sessionDetails.innerHTML = '';
      sessionJson.textContent = '';
    }
  }
});

loginComponent.onInit();
console.log('Mounted JARVIS Login & LocalStorage Screen');
