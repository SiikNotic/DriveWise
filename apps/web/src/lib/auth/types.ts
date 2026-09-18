export interface ActionState {
  error?: string;
  success?: boolean;
  /** Set on sign-up when email confirmation is required before sign-in works. */
  checkEmail?: boolean;
  /** The address a confirmation/recovery email was sent to, for display. */
  email?: string;
}

export const initialActionState: ActionState = {};
