import "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView, ScrollView, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useEveryYouApp } from "./hooks/useEveryYouApp";
import { useScreenshotPrompt } from "./hooks/useScreenshotPrompt";
import { AppHeader } from "./components/AppHeader";
import { BottomNav } from "./components/BottomNav";
import { EditItemModal } from "./components/EditItemModal";
import { FileImportOverlay } from "./components/FileImportOverlay";
import { OnboardingOverlay } from "./components/OnboardingOverlay";
import { ScreenshotPrompt } from "./components/ScreenshotPrompt";
import { TabScreens } from "./components/TabScreens";
import { Toast } from "./components/Toast";
import { LibraryScreen } from "./screens/LibraryScreen";
import { appStyles } from "./styles/appStyles";
import { getTheme } from "./styles/theme";

export default function App() {
  const app = useEveryYouApp();
  const theme = getTheme(app.themeMode);
  const screenshot = useScreenshotPrompt();
  const isLibraryTab = app.tab === "library";

  return (
    <GestureHandlerRootView style={[appStyles.safeArea, { backgroundColor: theme.background }]}>
      <SafeAreaView style={[appStyles.safeArea, { backgroundColor: theme.background }]}>
        <StatusBar style={app.themeMode === "dark" ? "light" : "dark"} />
        <View style={[appStyles.shell, { backgroundColor: theme.background }]}>
          <ScreenshotPrompt
            visible={screenshot.screenshotPromptVisible}
            theme={theme}
            status={screenshot.screenshotStatus}
            loading={screenshot.screenshotActionLoading}
            onShare={screenshot.shareLatestScreenshot}
            onDismiss={() => {
              screenshot.setScreenshotPromptVisible(false);
              screenshot.setScreenshotStatus(null);
            }}
          />

          <OnboardingOverlay app={app} theme={theme} />

          <FileImportOverlay
            visible={app.fileImportBusy}
            canCancel={app.fileImportCanCancel}
            theme={theme}
            onCancel={app.cancelFileImportOpening}
          />

          {isLibraryTab ? (
            <View style={[appStyles.libraryShell, { backgroundColor: theme.background }]}>
              <View style={appStyles.libraryHeader}>
                <AppHeader app={app} theme={theme} compact={false} />
              </View>
              <LibraryScreen
                themeMode={app.themeMode}
                typeFilter={app.typeFilter}
                sourceFilter={app.sourceFilter}
                timeQualityFilter={app.timeQualityFilter}
                undatedVisibleLibrary={app.undatedVisibleLibrary}
                timelineSpreading={app.timelineSpreading}
                timelinePromptVisible={app.timelinePromptVisible}
                selectedItem={app.selectedItem}
                visibleLibrary={app.visibleLibrary}
                onTypeFilterChange={app.setTypeFilter}
                onSourceFilterChange={app.setSourceFilter}
                onTimeQualityFilterChange={app.setTimeQualityFilter}
                onSelectItem={app.setSelectedId}
                onSpread={app.spreadTimeline}
                onAssignItemTime={app.assignItemTime}
                onAssignSelected={app.assignSelectedTime}
                onMoveItemsToDate={app.moveItemsToDate}
                onDismissTimelinePrompt={app.dismissTimelinePrompt}
                onEditItem={(id) => {
                  app.setSelectedId(null);
                  app.startEdit(id);
                }}
                onDeleteItem={app.removeItem}
                dailyStepsByDay={app.dailyStepsByDay}
                healthStepsEnabled={app.healthStepsEnabled}
              />
            </View>
          ) : (
            <ScrollView
              style={[appStyles.scroll, { backgroundColor: theme.background }]}
              contentContainerStyle={[
                appStyles.container,
                appStyles.containerCompact,
                { backgroundColor: theme.background },
              ]}
            >
              <AppHeader app={app} theme={theme} compact />
              <TabScreens app={app} />
            </ScrollView>
          )}

          <EditItemModal app={app} theme={theme} visible={Boolean(app.editingId)} />

          <View style={appStyles.bottomBarWrap}>
            <Toast message={app.toastMessage} theme={theme} />
            <BottomNav tab={app.tab} theme={theme} onSelect={app.setTab} />
          </View>
        </View>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}
