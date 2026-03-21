import { useMemo, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  PanResponder,
  Pressable,
  Text,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type View as RNView,
} from "react-native";
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
type TimelineDragPreset = "this_month" | "last_month" | "last_6_months" | "this_year" | "very_old";

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
  onAssignItemTime: (id: string, preset: TimelineDragPreset) => void;
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
  const [draggingItem, setDraggingItem] = useState<LibraryItem | null>(null);
  const [activeDropPreset, setActiveDropPreset] = useState<TimelineDragPreset | null>(null);
  const dragPosition = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const dropZoneRefs = useRef<Record<TimelineDragPreset, RNView | null>>({
    this_month: null,
    last_month: null,
    last_6_months: null,
    this_year: null,
    very_old: null,
  });
  const dropZones = useRef<Record<TimelineDragPreset, { x: number; y: number; width: number; height: number }>>({
    this_month: { x: 0, y: 0, width: 0, height: 0 },
    last_month: { x: 0, y: 0, width: 0, height: 0 },
    last_6_months: { x: 0, y: 0, width: 0, height: 0 },
    this_year: { x: 0, y: 0, width: 0, height: 0 },
    very_old: { x: 0, y: 0, width: 0, height: 0 },
  }).current;

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

  function measureDropZone(preset: TimelineDragPreset) {
    dropZoneRefs.current[preset]?.measureInWindow((x, y, width, height) => {
      dropZones[preset] = { x, y, width, height };
    });
  }

  function beginDrag(item: LibraryItem, event: GestureResponderEvent) {
    setDraggingItem(item);
    setActiveDropPreset(null);
    dragPosition.setValue({
      x: event.nativeEvent.pageX - 88,
      y: event.nativeEvent.pageY - 62,
    });
    requestAnimationFrame(() => {
      (Object.keys(dropZoneRefs.current) as TimelineDragPreset[]).forEach((preset) => measureDropZone(preset));
    });
  }

  function registerDropZone(preset: TimelineDragPreset, _event: LayoutChangeEvent) {
    requestAnimationFrame(() => measureDropZone(preset));
  }

  function resolveDropPreset(pageX: number, pageY: number) {
    const entries = Object.entries(dropZones) as Array<
      [TimelineDragPreset, { x: number; y: number; width: number; height: number }]
    >;
    return (
      entries.find(([, zone]) => {
        return (
          pageX >= zone.x &&
          pageX <= zone.x + zone.width &&
          pageY >= zone.y &&
          pageY <= zone.y + zone.height
        );
      })?.[0] ?? null
    );
  }

  const dragResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: () => Boolean(draggingItem),
        onMoveShouldSetPanResponderCapture: () => Boolean(draggingItem),
        onPanResponderMove: (event) => {
          if (!draggingItem) return;
          dragPosition.setValue({
            x: event.nativeEvent.pageX - 88,
            y: event.nativeEvent.pageY - 62,
          });
          setActiveDropPreset(resolveDropPreset(event.nativeEvent.pageX, event.nativeEvent.pageY));
        },
        onPanResponderRelease: (event) => {
          if (draggingItem) {
            const preset = resolveDropPreset(event.nativeEvent.pageX, event.nativeEvent.pageY);
            if (preset) {
              onAssignItemTime(draggingItem.id, preset);
            }
          }

          Animated.spring(dragPosition, {
            toValue: { x: 0, y: 0 },
            damping: 16,
            stiffness: 190,
            useNativeDriver: true,
          }).start(() => {
            setDraggingItem(null);
            setActiveDropPreset(null);
          });
        },
        onPanResponderTerminate: () => {
          Animated.spring(dragPosition, {
            toValue: { x: 0, y: 0 },
            damping: 16,
            stiffness: 190,
            useNativeDriver: true,
          }).start(() => {
            setDraggingItem(null);
            setActiveDropPreset(null);
          });
        },
      }),
    [dragPosition, draggingItem, onAssignItemTime]
  );

  function renderDropTarget(
    preset: TimelineDragPreset,
    label: string,
    hint: string,
    onPress: () => void
  ) {
    return (
      <View
        ref={(node) => {
          dropZoneRefs.current[preset] = node;
        }}
        onLayout={(event) => registerDropZone(preset, event)}
        style={[
          appStyles.timelineDropTarget,
          activeDropPreset === preset && appStyles.timelineDropTargetActive,
        ]}
      >
        <Pressable style={appStyles.timelineDropTargetPress} onPress={onPress} disabled={timelineSpreading}>
          <Text style={appStyles.timelineDropTargetTitle}>{label}</Text>
          <Text style={appStyles.timelineDropTargetHint}>{hint}</Text>
        </Pressable>
      </View>
    );
  }

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
        onLongPress={(event) => beginDrag(item, event)}
        delayLongPress={180}
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
              <Pressable
                style={appStyles.timelineDragHandle}
                onLongPress={(event) => beginDrag(item, event)}
                delayLongPress={180}
              >
                <Text style={appStyles.timelineDragHandleText}>↕</Text>
              </Pressable>
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

      {draggingItem ? (
        <View pointerEvents="none" style={appStyles.timelineDragPanel}>
          <View style={[appStyles.card, appStyles.cardAccentYellow]}>
            <Text style={appStyles.sectionTitle}>перетащи по времени</Text>
            <Text style={appStyles.helper}>зажми карточку и отпусти на нужном периоде. дата сразу обновится.</Text>
            <View style={appStyles.timelineDropGrid}>
              {renderDropTarget(
                "this_month",
                "недавно",
                activeDropPreset === "this_month" ? "отпусти, и поставим этот месяц" : "этот месяц",
                onAssignSelectedThisMonth
              )}
              {renderDropTarget(
                "last_month",
                "прошлый месяц",
                activeDropPreset === "last_month" ? "отпусти, и поставим прошлый месяц" : "месяц назад",
                onAssignSelectedLastMonth
              )}
              {renderDropTarget(
                "last_6_months",
                "полгода",
                activeDropPreset === "last_6_months" ? "отпусти, и разложим за полгода" : "последние 6 месяцев",
                onAssignSelectedLast6Months
              )}
              {renderDropTarget(
                "this_year",
                "этот год",
                activeDropPreset === "this_year" ? "отпусти, и поставим этот год" : "внутри года",
                onAssignSelectedThisYear
              )}
              {renderDropTarget(
                "very_old",
                "очень давно",
                activeDropPreset === "very_old" ? "отпусти, и унесем далеко назад" : "пару лет назад",
                onAssignSelectedVeryOld
              )}
            </View>
          </View>
        </View>
      ) : null}

      <View
        style={appStyles.dragCaptureLayer}
        pointerEvents={draggingItem ? "auto" : "box-none"}
        {...dragResponder.panHandlers}
      >
        {draggingItem ? (
          <Animated.View
            pointerEvents="none"
            style={[
              appStyles.timelineDragGhost,
              {
                transform: [{ translateX: dragPosition.x }, { translateY: dragPosition.y }],
              },
            ]}
          >
            <Text style={appStyles.timelineDragGhostType}>{TYPE_LABEL[draggingItem.type]}</Text>
            <Text style={appStyles.timelineDragGhostTitle}>{draggingItem.title}</Text>
            <Text style={appStyles.timelineDragGhostHint}>
              {activeDropPreset === "this_month"
                ? "отпускай: недавно"
                : activeDropPreset === "last_month"
                  ? "отпускай: прошлый месяц"
                  : activeDropPreset === "last_6_months"
                    ? "отпускай: полгода"
                    : activeDropPreset === "this_year"
                      ? "отпускай: этот год"
                      : activeDropPreset === "very_old"
                        ? "отпускай: очень давно"
                        : "веди к нужному периоду"}
            </Text>
          </Animated.View>
        ) : null}
      </View>
    </View>
  );
}
