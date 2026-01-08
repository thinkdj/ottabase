export { LoginForm, type LoginFormProps } from "./LoginForm";
export { CredentialsForm, type CredentialsFormProps } from "./CredentialsForm";
export { MagicLinkForm, type MagicLinkFormProps } from "./MagicLinkForm";
export { RegisterForm, type RegisterFormProps, type RegisterFormData } from "./RegisterForm";
export {
    SocialLoginButtons,
    SocialLoginDivider,
    type SocialLoginButtonsProps,
    type SocialLoginDividerProps,
    type SocialProvider,
} from "./SocialLoginButtons";

// Helper utilities
export {
    getConfiguredSocialProviders,
    isCredentialsConfigured,
    isEmailProviderConfigured,
    getLoginConfig,
} from "./helpers";
