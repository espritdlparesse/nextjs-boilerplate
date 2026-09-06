import { StyleSheet } from "react-native";

import { colors } from "./colors";

export const profileStyles = StyleSheet.create({
  profileHero: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  profileAvatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.black,
    alignItems: "center",
    justifyContent: "center",
  },
  profileAvatarImage: {
    width: 76,
    height: 76,
    borderRadius: 38,
  },
  profileAvatarText: {
    fontSize: 26,
    fontWeight: "900",
    color: colors.white,
  },
  profileHeroText: {
    flex: 1,
    gap: 4,
  },
  profileStatsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  profileStatTile: {
    width: "47%",
    backgroundColor: colors.white,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 12,
    paddingVertical: 14,
    gap: 4,
  },
  profileStatValue: {
    fontSize: 28,
    fontWeight: "900",
    color: colors.black,
    textTransform: "lowercase",
  },
  profileStatLabel: {
    fontSize: 13,
    color: colors.subtext,
    fontWeight: "800",
    textTransform: "lowercase",
  },
});
