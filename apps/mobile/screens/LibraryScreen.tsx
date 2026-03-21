import { useMemo, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import {
  formatFullDate,
  getConsumptionDate,
  TYPE_LABEL,
  type ContentType,
  type LibraryItem,
  type SourceType,
} from "../shared/everyyou/domain";
import { PillButton } from "../components/PillButton";
import { appStyles } from "../styles/appStyles";

type TypeFilter = ContentType | "all";
type SourceFilter = SourceType | "all";
type LibraryViewMode = "tiles" | "timeline";

type LibraryScreenProps = {
  typeFilter: TypeFilter;
  sourceFilter: SourceFilter;
  undatedVisibleLibrary: LibraryItem[];
  timelineSpreading: boolean;
  timelinePromptVisible: boolean;
  selectedItem: LibraryItem | null;
  visibleLibrary: LibraryItem[];
  onTypeFilterChange: (value: TypeFilter) => void;
  onSourceFilterChange: (value: SourceFilter) => void;
  onSelectItem: (id: string) => void;
  onSpreadThisMonth: () => void;
  onSpreadLastMonth: () => void;
  onSpreadLast6Months: () => void;
  onSpreadThisYear: () => void;
  onSpreadVeryOld: () => void;
  onAssignItemTime: (id: string, preset: "this_month" | "last_month" | "last_6_months" | "this_year" | "very_old") => void;
  onAssignSelectedThisMonth: () => void;
  onAssignSelectedLastMonth: () => void;
  onAssignSelectedLast6Months: () => void;
  onAssignSelectedThisYear: () => void;
  onAssignSelectedVeryOld: () => void;
  onDismissTimelinePrompt: () => void;
  onEditItem: (id: string) => void;
  onDeleteItem: (id: string) => void;
};

function typeTileStyle(type: LibraryItem["type"]) {
  if (type === "music") return appStyles.tilePink;
  if (type === "book") return appStyles.tileBlue;
  return appStyles.tileYellow;
}

function monthLabel(consumedAt?: number) {
  if (!consumedAt) return "без времени";
  return new Date(consumedAt)
    .toLocaleString("ru-RU", {
      month: "long",
      year: "numeric",
    })
    .toLowerCase();
}

export function LibraryScreen({
  typeFilter,
  sourceFilter,
  undatedVisibleLibrary,
  timelineSpreading,
  timelinePromptVisible,
  selectedItem,
  visibleLibrary,
  onTypeFilterChange,
  onSourceFilterChange,
  onSelectItem,
  onSpreadThisMonth,
  onSpreadLastMonth,
  onSpreadLast6Months,
  onSpreadThisYear,
  onSpreadVeryOld,
  onAssignItemTime,
  onAssignSelectedThisMonth,
  onAssignSelectedLastMonth,
  onAssignSelectedLast6Months,
  onAssignSelectedThisYear,
  onAssignSelectedVeryOld,
  onDismissTimelinePrompt,
  onEditItem,
  onDeleteItem,
}: LibraryScreenProps) {
  const [viewMode, setViewMode] = useState<LibraryViewMode>("tiles");

  const timelineGroups = useMemo(() => {
    const groups = new Map<string, LibraryItem[]>();
    for (const item of visibleLibrary) {
      const key = monthLabel(getConsumptionDate(item));
      const bucket = groups.get(key) ?? [];
      bucket.push(item);
      groups.set(key, bucket);
    }

    return Array.from(groups.entries()).map(([label, items]) => ({ label, items }));
  }, [visibleLibrary]);

  function renderTopCards() {
    return (
      <View style={appStyles.libraryListTop}>
        <View style={[appStyles.card, appStyles.cardAccentPink]}>
          <Text style={appStyles.sectionTitle}>библиотека</Text>
          <Text style={appStyles.helper}>
            смотри все вместе или раскладывай по типам. в карточках видна дата, чтобы библиотека ощущалась как личная история, а не архив.
          </Text>

          <Text style={appStyles.label}>режим</Text>
          <View style={appStyles.row}>
            <PillButton label="плитки" active={viewMode === "tiles"} onPress={() => setViewMode("tiles")} />
            <PillButton label="таймлайн" active={viewMode === "timeline"} onPress={() => setViewMode("timeline")} />
          </View>

          <Text style={appStyles.label}>тип контента</Text>
          <View style={appStyles.row}>
            {(["all", "music", "book", "film"] as TypeFilter[]).map((value) => (
              <PillButton
                key={value}
                label={value === "all" ? "все" : TYPE_LABEL[value]}
                active={typeFilter === value}
                onPress={() => onTypeFilterChange(value)}
              />
            ))}
          </View>
        </View>

        {timelinePromptVisible && undatedVisibleLibrary.length > 0 ? (
          <View style={[appStyles.card, appStyles.cardAccentGreen]}>
            <Text style={appStyles.sectionTitle}>когда это было?</Text>
            <Text style={appStyles.helper}>
              мы добавили {undatedVisibleLibrary.length} импортированн{undatedVisibleLibrary.length === 1 ? "ую карточку" : "ых карточек"} без времени. выбери, как это примерно разложить по твоей линии времени.
            </Text>
            <View style={appStyles.row}>
              <PillButton
                label={timelineSpreading ? "раскладываем..." : "это было недавно"}
                onPress={onSpreadThisMonth}
                disabled={timelineSpreading}
              />
              <PillButton label="это было в прошлом месяце" onPress={onSpreadLastMonth} disabled={timelineSpreading} />
              <PillButton label="это было за последние полгода" onPress={onSpreadLast6Months} disabled={timelineSpreading} />
              <PillButton label="это было в этом году" onPress={onSpreadThisYear} disabled={timelineSpreading} />
              <PillButton label="это было очень давно" onPress={onSpreadVeryOld} disabled={timelineSpreading} />
              <PillButton label="разложу потом" onPress={onDismissTimelinePrompt} disabled={timelineSpreading} />
            </View>
          </View>
        ) : null}

        {selectedItem ? (
          <View style={[appStyles.tile, typeTileStyle(selectedItem.type)]}>
            <View style={appStyles.tileTopRow}>
              <View style={appStyles.typeBadge}>
                <Text style={appStyles.typeBadgeText}>{TYPE_LABEL[selectedItem.type]}</Text>
              </View>
              <Text style={appStyles.metaDate}>
                {getConsumptionDate(selectedItem)
                  ? formatFullDate(getConsumptionDate(selectedItem) as number)
                  : "выбери время"}
              </Text>
            </View>
            <Text style={appStyles.itemTitle}>{selectedItem.title}</Text>
            <Text style={appStyles.itemMeta}>{selectedItem.authorOrArtist || "без автора"}</Text>
            {!getConsumptionDate(selectedItem) ? (
              <View style={appStyles.stack}>
                <Text style={appStyles.metaText}>когда это было примерно?</Text>
                <View style={appStyles.row}>
                  <PillButton label="недавно" onPress={onAssignSelectedThisMonth} disabled={timelineSpreading} />
                  <PillButton label="прошлый месяц" onPress={onAssignSelectedLastMonth} disabled={timelineSpreading} />
                  <PillButton label="полгода" onPress={onAssignSelectedLast6Months} disabled={timelineSpreading} />
                  <PillButton label="этот год" onPress={onAssignSelectedThisYear} disabled={timelineSpreading} />
                  <PillButton label="очень давно" onPress={onAssignSelectedVeryOld} disabled={timelineSpreading} />
                </View>
              </View>
            ) : null}
            <PillButton label="редактировать" onPress={() => onEditItem(selectedItem.id)} />
            <PillButton label="удалить" variant="danger" onPress={() => onDeleteItem(selectedItem.id)} />
          </View>
        ) : null}
      </View>
    );
  }

  function renderTileItem({ item }: { item: LibraryItem }) {
    return (
      <Pressable
        style={[appStyles.tile, appStyles.libraryTile, typeTileStyle(item.type)]}
        onPress={() => onSelectItem(item.id)}
      >
        <View style={appStyles.tileTopRow}>
          <View style={appStyles.typeBadge}>
            <Text style={appStyles.typeBadgeText}>{TYPE_LABEL[item.type]}</Text>
          </View>
          <Text style={appStyles.metaDate}>
            {getConsumptionDate(item) ? formatFullDate(getConsumptionDate(item) as number) : "без времени"}
          </Text>
        </View>

        <View>
          <Text style={appStyles.itemMeta}>{item.authorOrArtist || TYPE_LABEL[item.type]}</Text>
          <Text style={appStyles.itemTitle}>{item.title}</Text>
        </View>

        {!getConsumptionDate(item) ? (
          <View style={appStyles.row}>
            <PillButton label="недавно" onPress={() => onAssignItemTime(item.id, "this_month")} disabled={timelineSpreading} />
            <PillButton label="месяц" onPress={() => onAssignItemTime(item.id, "last_month")} disabled={timelineSpreading} />
            <PillButton label="полгода" onPress={() => onAssignItemTime(item.id, "last_6_months")} disabled={timelineSpreading} />
          </View>
        ) : null}
      </Pressable>
    );
  }

  function renderTimelineGroup({ item: group }: { item: { label: string; items: LibraryItem[] } }) {
    return (
      <View style={[appStyles.card, appStyles.timelineCard]}>
        <Text style={appStyles.timelineMonth}>{group.label}</Text>
        <View style={appStyles.stack}>
          {group.items.map((item) => (
            <Pressable key={item.id} style={appStyles.timelineRow} onPress={() => onSelectItem(item.id)}>
              <View style={[appStyles.timelineDot, typeTileStyle(item.type)]} />
              <View style={appStyles.timelineContent}>
                <View style={appStyles.timelineHeader}>
                  <Text style={appStyles.timelineType}>{TYPE_LABEL[item.type]}</Text>
                  <Text style={appStyles.metaDate}>
                    {getConsumptionDate(item) ? formatFullDate(getConsumptionDate(item) as number) : "без времени"}
                  </Text>
                </View>
                <Text style={appStyles.itemMeta}>{item.authorOrArtist || TYPE_LABEL[item.type]}</Text>
                <Text style={appStyles.timelineTitle}>{item.title}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={appStyles.libraryScreen}>
      {viewMode === "timeline" ? (
        <FlatList
          data={timelineGroups}
          keyExtractor={(item) => item.label}
          renderItem={renderTimelineGroup}
          ListHeaderComponent={renderTopCards}
          ListEmptyComponent={
            <View style={appStyles.card}>
              <Text style={appStyles.helper}>пока пусто. попробуй импорт из spotify, импорт изображений или загрузку файла.</Text>
            </View>
          }
          contentContainerStyle={appStyles.libraryListContent}
          ItemSeparatorComponent={() => <View style={appStyles.libraryListSpacer} />}
          showsVerticalScrollIndicator={false}
          initialNumToRender={6}
          maxToRenderPerBatch={8}
          windowSize={7}
        />
      ) : (
        <FlatList
          data={visibleLibrary}
          keyExtractor={(item) => item.id}
          renderItem={renderTileItem}
          numColumns={2}
          ListHeaderComponent={renderTopCards}
          ListEmptyComponent={
            <View style={appStyles.card}>
              <Text style={appStyles.helper}>пока пусто. попробуй импорт из spotify, импорт изображений или загрузку файла.</Text>
            </View>
          }
          contentContainerStyle={appStyles.libraryListContent}
          columnWrapperStyle={appStyles.libraryColumn}
          ItemSeparatorComponent={() => <View style={appStyles.libraryListSpacer} />}
          showsVerticalScrollIndicator={false}
          initialNumToRender={12}
          maxToRenderPerBatch={14}
          windowSize={7}
        />
      )}
    </View>
  );
}
