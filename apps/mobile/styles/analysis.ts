import { StyleSheet } from "react-native";

import { colors } from "./colors";

export const analysisStyles = StyleSheet.create({
  resultModalClose: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  resultModalCloseText: {
    fontSize: 24,
    lineHeight: 24,
    fontWeight: "500",
    color: colors.black,
    marginTop: -2,
  },
});
