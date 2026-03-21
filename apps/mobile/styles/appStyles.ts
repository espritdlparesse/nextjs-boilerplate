import { StyleSheet } from "react-native";

export const appStyles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f6f1e8",
  },
  container: {
    padding: 20,
    gap: 16,
  },
  brand: {
    fontSize: 30,
    fontWeight: "900",
    color: "#22170f",
    textTransform: "lowercase",
  },
  subtitle: {
    fontSize: 16,
    color: "#5e4d42",
    textTransform: "lowercase",
  },
  syncText: {
    fontSize: 12,
    color: "#8c7868",
    textTransform: "lowercase",
  },
  tabs: {
    gap: 10,
    paddingVertical: 6,
  },
  card: {
    backgroundColor: "#fffaf3",
    borderRadius: 24,
    padding: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: "#eadfce",
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: "#22170f",
    textTransform: "lowercase",
  },
  helper: {
    fontSize: 15,
    lineHeight: 22,
    color: "#5e4d42",
    textTransform: "lowercase",
  },
  label: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: "900",
    color: "#8c7868",
    textTransform: "lowercase",
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  stack: {
    gap: 10,
    marginTop: 8,
  },
  input: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e3d5c2",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: "#22170f",
  },
  pillButton: {
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  primaryButton: {
    backgroundColor: "#22170f",
    borderColor: "#22170f",
  },
  secondaryButton: {
    backgroundColor: "#fff",
    borderColor: "#e3d5c2",
  },
  dangerButton: {
    backgroundColor: "#fff1ef",
    borderColor: "#efc0b7",
  },
  disabledButton: {
    opacity: 0.45,
  },
  activeTabButton: {
    backgroundColor: "#22170f",
    borderColor: "#22170f",
  },
  primaryText: {
    color: "#fffaf3",
    fontWeight: "900",
    textTransform: "lowercase",
  },
  secondaryText: {
    color: "#22170f",
    fontWeight: "900",
    textTransform: "lowercase",
  },
  tabText: {
    color: "#22170f",
    fontWeight: "800",
    textTransform: "lowercase",
  },
  activeTabText: {
    color: "#fffaf3",
    fontWeight: "900",
    textTransform: "lowercase",
  },
  optionChip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#e3d5c2",
    backgroundColor: "#fff",
  },
  optionChipActive: {
    backgroundColor: "#efe1cf",
    borderColor: "#d9c0a6",
  },
  optionText: {
    color: "#22170f",
    fontWeight: "700",
    textTransform: "lowercase",
  },
  tile: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: "#eadfce",
  },
  itemTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#22170f",
    textTransform: "lowercase",
  },
  itemMeta: {
    fontSize: 16,
    fontWeight: "700",
    color: "#5e4d42",
    textTransform: "lowercase",
  },
  metaText: {
    fontSize: 13,
    color: "#8c7868",
    lineHeight: 18,
    textTransform: "lowercase",
  },
});
