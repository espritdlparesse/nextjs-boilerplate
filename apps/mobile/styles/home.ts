import { StyleSheet } from "react-native";

import { colors } from "./colors";

export const homeStyles = StyleSheet.create({
  tileGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  homeFeatureTile: {
    width: "48%",
    minHeight: 204,
    justifyContent: "space-between",
    paddingTop: 12,
    paddingBottom: 14,
    gap: 8,
  },
  homeTileTextBlock: {
    gap: 8,
  },
  homeTileEyebrow: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "lowercase",
    letterSpacing: -0.2,
  },
  homeTileTitle: {
    fontSize: 20,
    lineHeight: 23,
    fontWeight: "900",
    color: colors.black,
    textTransform: "lowercase",
    letterSpacing: -0.7,
  },
  homeTileBody: {
    fontSize: 13,
    lineHeight: 19,
    textTransform: "lowercase",
    maxWidth: "94%",
  },
});
