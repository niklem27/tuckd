let shown = false;

export const introShownThisLaunch = () => shown;

export function markIntroShown() {
  shown = true;
}
