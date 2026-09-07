import { Pressable, Text, View } from "react-native";
import { appStyles } from "../styles/appStyles";
import type { getTheme } from "../styles/theme";
import type { useEveryYouApp } from "../hooks/useEveryYouApp";

export function OnboardingOverlay({ app, theme }: {
  app: ReturnType<typeof useEveryYouApp>;
  theme: ReturnType<typeof getTheme>;
}) {
  if (!app.showOnboarding) return null;
  return (
          <View style={[appStyles.busyOverlay, { backgroundColor: theme.overlay, zIndex: 35 }]}>
            <View
              style={[
                appStyles.busyOverlayCard,
                {
                  width: "100%",
                  maxWidth: 360,
                  alignItems: "stretch",
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                  gap: 12,
                },
              ]}
            >
              <Text style={[appStyles.busyOverlayTitle, { color: theme.text, fontSize: 28, textAlign: "left" }]}>
                {app.onboardingVariant === "linked"
                  ? app.onboardingStep === 0
                    ? "библиотека уже здесь"
                    : "теперь все на айфоне"
                  : app.onboardingStep === 0
                    ? "твой культурный таймлайн"
                    : app.onboardingStep === 1
                      ? "добавляй как удобно"
                      : "потом станет интереснее"}
              </Text>

              <Text style={[appStyles.busyOverlayText, { color: theme.text, textAlign: "left", fontSize: 16, lineHeight: 24 }]}>
                {app.onboardingVariant === "linked"
                  ? app.onboardingStep === 0
                    ? "мы уже подтянули твою библиотеку. теперь можно продолжать на айфоне и не терять музыку, книги, фильмы и вайбчеки."
                    : "добавляй новый контент отсюда, смотри календарь и делай вайбчек уже в приложении."
                  : app.onboardingStep === 0
                    ? "сюда можно скидывать музыку, книги и фильмы, которые реально были с тобой. не список на потом, а след того, что происходило."
                    : app.onboardingStep === 1
                      ? "можно подключить сервис, загрузить скриншот, фотку книжной полки или просто вписать все вручную."
                      : "из этого собираются библиотека, календарь и вайбчек, который начинает замечать темы, периоды и сдвиги в настроении."}
              </Text>

              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                {app.onboardingVariant === "linked" ? (
                  <>
                    <View
                      style={{
                        flexBasis: "48%",
                        borderRadius: 22,
                        padding: 14,
                        backgroundColor: theme.accentBlue,
                        borderWidth: 1,
                        borderColor: theme.border,
                        gap: 4,
                      }}
                    >
                      <Text style={{ color: theme.accentMutedText, fontSize: 11, fontWeight: "800", textTransform: "lowercase" }}>библиотека</Text>
                      <Text style={{ color: theme.accentText, fontSize: 18, fontWeight: "900", textTransform: "lowercase" }}>{app.counters.total}</Text>
                      <Text style={{ color: theme.accentMutedText, fontSize: 12 }}>уже на месте</Text>
                    </View>
                    <View
                      style={{
                        flexBasis: "48%",
                        borderRadius: 22,
                        padding: 14,
                        backgroundColor: theme.accentGreen,
                        borderWidth: 1,
                        borderColor: theme.border,
                        gap: 4,
                      }}
                    >
                      <Text style={{ color: theme.accentMutedText, fontSize: 11, fontWeight: "800", textTransform: "lowercase" }}>дальше</Text>
                      <Text style={{ color: theme.accentText, fontSize: 18, fontWeight: "900", textTransform: "lowercase" }}>календарь и вайбчек</Text>
                      <Text style={{ color: theme.accentMutedText, fontSize: 12 }}>теперь уже на айфоне</Text>
                    </View>
                  </>
                ) : (
                  <>
                    <View
                      style={{
                        flexBasis: "48%",
                        borderRadius: 22,
                        padding: 14,
                        backgroundColor: theme.accentPink,
                        borderWidth: 1,
                        borderColor: theme.border,
                        gap: 4,
                      }}
                    >
                      <Text style={{ color: theme.accentMutedText, fontSize: 11, fontWeight: "800", textTransform: "lowercase" }}>музыка</Text>
                      <Text style={{ color: theme.accentText, fontSize: 18, fontWeight: "900", textTransform: "lowercase" }}>спотифай и last.fm</Text>
                    </View>
                    <View
                      style={{
                        flexBasis: "48%",
                        borderRadius: 22,
                        padding: 14,
                        backgroundColor: theme.accentGreen,
                        borderWidth: 1,
                        borderColor: theme.border,
                        gap: 4,
                      }}
                    >
                      <Text style={{ color: theme.accentMutedText, fontSize: 11, fontWeight: "800", textTransform: "lowercase" }}>книги и фильмы</Text>
                      <Text style={{ color: theme.accentText, fontSize: 18, fontWeight: "900", textTransform: "lowercase" }}>фото, csv и ручной импорт</Text>
                    </View>
                  </>
                )}
              </View>

              <View style={{ flexDirection: "row", gap: 8 }}>
                {[0, 1, ...(app.onboardingVariant === "fresh" ? [2] : [])].map((step) => (
                  <View
                    key={step}
                    style={{
                      height: 6,
                      flex: 1,
                      borderRadius: 999,
                      backgroundColor: step <= app.onboardingStep ? theme.buttonPrimaryBg : theme.surfaceMuted,
                    }}
                  />
                ))}
              </View>

              <View style={appStyles.row}>
                <Pressable
                  style={[
                    appStyles.pillButton,
                    { flex: 1, backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                  ]}
                  onPress={app.skipOnboarding}
                >
                  <Text style={[appStyles.secondaryText, { color: theme.text }]}>пропустить</Text>
                </Pressable>
                <Pressable
                  style={[
                    appStyles.pillButton,
                    appStyles.primaryButton,
                    { flex: 1, backgroundColor: theme.buttonPrimaryBg, borderColor: theme.buttonPrimaryBorder },
                  ]}
                  onPress={app.nextOnboardingStep}
                >
                  <Text style={[appStyles.primaryText, { color: theme.buttonPrimaryText }]}>
                    {app.onboardingVariant === "fresh"
                      ? app.onboardingStep === 2
                        ? "начать"
                        : "дальше"
                      : app.onboardingStep === 1
                        ? "поехали"
                        : "дальше"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
  );
}
