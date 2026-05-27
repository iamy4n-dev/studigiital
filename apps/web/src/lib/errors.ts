export function mapErrorMessage(status: number): string {
  if (status === 422) {
    return "Your text was too short or invalid — try adding more detail.";
  }
  if (status >= 500) {
    return "Something went wrong on our end. Try again in a moment.";
  }
  return "Something went wrong. Try again.";
}
