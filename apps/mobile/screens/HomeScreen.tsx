import { Text, View } from "react-native";
import { PillButton } from "../components/PillButton";
import { appStyles } from "../styles/appStyles";

type HomeScreenProps = {
  onAddPress: () => void;
};

export function HomeScreen({ onAddPress }: HomeScreenProps) {
  return (
    <View style={appStyles.card}>
      <Text style={appStyles.sectionTitle}>что это</Text>
      <Text style={appStyles.helper}>
        здесь собирается музыка, книги и фильмы в одном месте, чтобы приложение потом могло видеть общую картину.
      </Text>
      <Text style={appStyles.helper}>
        мобильная версия сейчас повторяет сценарий mini app, но уже без жесткой привязки к Telegram UI.
      </Text>
      <PillButton
        label="добавить контент"
        variant="primary"
        onPress={onAddPress}
      />
    </View>
  );
}
