export { LoginForm, type LoginFormProps } from './LoginForm';
export { CredentialsForm, type CredentialsFormProps } from './CredentialsForm';
export { MagicLinkForm, type MagicLinkFormProps } from './MagicLinkForm';
export { RegisterForm, type RegisterFormProps, type RegisterFormData } from './RegisterForm';
export {
    SocialLoginButtons,
    SocialLoginDivider,
    type SocialLoginButtonsProps,
    type SocialLoginDividerProps,
    type SocialProvider,
} from './SocialLoginButtons';

// NOTE: The pure login-config helpers (getLoginConfig, getConfiguredSocialProviders,
// isCredentialsConfigured, isEmailProviderConfigured) live on the dependency-free
// `@ottabase/auth/config` subpath so backend/edge callers pull zero UI deps. This
// `./components` barrel is UI-only (rendered shadcn/lucide forms).
