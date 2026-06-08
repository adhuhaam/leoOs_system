import colors from "@/constants/colors";

/**
 * Returns the design tokens for the light palette.
 * The app is intentionally always light — ignore device dark mode.
 */
export function useColors() {
  return { ...colors.light, radius: colors.radius };
}
