import { StyleSheet } from "react-native";

import { colors } from "./colors";

export const libraryStyles = StyleSheet.create({
  libraryScreen: {
    flex: 1,
  },
  libraryListContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 140,
  },
  libraryListTop: {
    gap: 16,
    marginBottom: 16,
  },
  libraryTopCompactCard: {
    gap: 10,
    paddingTop: 16,
    paddingBottom: 16,
  },
  libraryIntroCompact: {
    fontSize: 14,
    lineHeight: 20,
  },
  compactFilterSection: {
    gap: 8,
  },
  compactFilterHeader: {
    fontSize: 12,
    fontWeight: "900",
    color: colors.subtext,
    textTransform: "lowercase",
  },
  compactAccordionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  compactAccordionMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  compactAccordionValue: {
    fontSize: 12,
    color: colors.subtext,
    textTransform: "lowercase",
  },
  compactAccordionChevron: {
    fontSize: 16,
    fontWeight: "900",
    color: colors.subtext,
  },
  compactFilterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  compactPillButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 0,
  },
  libraryListSpacer: {
    height: 12,
  },
  libraryColumn: {
    gap: 12,
  },
  dayDetailTile: {
    minHeight: 146,
    borderRadius: 22,
    padding: 10,
    gap: 5,
  },
  itemMeta: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    textTransform: "lowercase",
  },
  dayDetailTitle: {
    fontSize: 13,
    letterSpacing: -0.25,
    lineHeight: 15,
  },
  dayDetailMeta: {
    fontSize: 12,
    lineHeight: 14,
  },
  dayDetailDate: {
    fontSize: 10,
    maxWidth: 56,
  },
  dayDetailOrigin: {
    fontSize: 10,
    lineHeight: 12,
  },
  libraryTile: {
    flex: 1,
    minHeight: 146,
    justifyContent: "space-between",
    paddingTop: 13,
    paddingBottom: 13,
  },
  calendarCard: {
    gap: 14,
  },
  monthLevelCard: {
    gap: 10,
    paddingTop: 16,
    paddingBottom: 16,
  },
  monthLevelTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  monthLevelTextBlock: {
    flex: 1,
    gap: 6,
  },
  monthLevelTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: colors.black,
    textTransform: "lowercase",
    letterSpacing: -0.6,
  },
  monthLevelBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  monthLevelModalText: {
    marginTop: 4,
    fontSize: 15,
    lineHeight: 22,
  },
  calendarDayActive: {
    borderColor: colors.black,
    backgroundColor: "#FFF7D0",
  },
  calendarDayNumberMuted: {
    color: "#9A9A9A",
  },
  calendarDotRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  calendarDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#FFFFFF",
  },
  calendarMore: {
    fontSize: 10,
    color: colors.subtext,
    textTransform: "lowercase",
  },
  calendarStepsText: {
    fontSize: 9,
    color: colors.subtext,
    textTransform: "lowercase",
    marginTop: 1,
  },
  weekStrip: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    paddingVertical: 0,
    paddingRight: 8,
  },
  weekStripScroll: {
    flexGrow: 0,
    maxHeight: 50,
    minHeight: 50,
    marginTop: 2,
    marginBottom: 4,
  },
  dayTypeFilterRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 6,
  },
  dayTypeFilterPill: {
    minHeight: 34,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  calendarMoveBanner: {
    gap: 10,
    paddingTop: 14,
    paddingBottom: 14,
  },
  calendarMoveTitle: {
    marginBottom: 0,
  },
  dayActionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  dayActionPill: {
    minHeight: 36,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  dayStepsCard: {
    gap: 4,
    paddingTop: 12,
    paddingBottom: 12,
    borderRadius: 20,
  },
  dayStepsTitle: {
    fontSize: 12,
    fontWeight: "900",
    color: colors.subtext,
    textTransform: "lowercase",
  },
  dayStepsValue: {
    fontSize: 24,
    fontWeight: "900",
    color: colors.black,
    textTransform: "lowercase",
    letterSpacing: -0.6,
  },
  dayGridPressable: {
    flex: 1,
    position: "relative",
  },
  daySelectionBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: colors.black,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.white,
  },
  daySelectionBadgeText: {
    fontSize: 9,
    fontWeight: "900",
    color: colors.white,
    textTransform: "lowercase",
  },
  weekDayChip: {
    minWidth: 48,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    gap: 1,
  },
  weekDayChipActive: {
    backgroundColor: colors.black,
    borderColor: colors.black,
    transform: [{ scale: 1.02 }],
  },
  weekDayName: {
    fontSize: 9,
    fontWeight: "800",
    color: colors.subtext,
    textTransform: "lowercase",
  },
  weekDayNameActive: {
    color: colors.white,
  },
  weekDayNumber: {
    fontSize: 13,
    fontWeight: "900",
    color: colors.black,
  },
  weekDayNumberActive: {
    color: colors.white,
  },
  dayModalGridRow: {
    gap: 8,
    marginBottom: 8,
  },
  tileTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: "#FFFFFF",
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: "900",
    color: colors.black,
    textTransform: "lowercase",
  },
});
