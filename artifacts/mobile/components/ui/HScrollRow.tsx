/**
 * Horizontal chip strip that starts on the correct edge in RTL.
 *
 * The app renders RTL per-component (`row-reverse`) rather than flipping the
 * whole layout through I18nManager, so a horizontal ScrollView still scrolls
 * left-to-right. With reversed content an Arabic strip opens on its *last*
 * chip and clips the first one — which is what buried "خطة درس" off the edge
 * of the lesson card.
 *
 * On web the reliable fix is CSS: `direction: rtl` makes the browser lay the
 * row out right-to-left AND start the scroll at the right edge, with no
 * measurement race. Content therefore stays in natural `row` order there.
 * On native there is no such thing, so we keep `row-reverse` and scroll to
 * the end once the content has been measured.
 */
import React, { useCallback, useRef } from 'react';
import { Platform, ScrollView, StyleProp, ViewStyle } from 'react-native';

type Props = {
  isRTL: boolean;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
};

const isWeb = Platform.OS === 'web';

export function HScrollRow({ isRTL, children, style, contentContainerStyle }: Props) {
  const ref = useRef<ScrollView>(null);

  const handleContentSizeChange = useCallback(() => {
    // Native only — on web the CSS direction below already positions it, and
    // scrolling here would fight the browser.
    if (isRTL && !isWeb) ref.current?.scrollToEnd({ animated: false });
  }, [isRTL]);

  const webRtl = isWeb && isRTL ? ({ direction: 'rtl' } as ViewStyle) : null;

  return (
    <ScrollView
      ref={ref}
      horizontal
      showsHorizontalScrollIndicator={false}
      onContentSizeChange={handleContentSizeChange}
      style={[style, webRtl]}
      contentContainerStyle={[
        // Under `direction: rtl` the browser reverses the row itself; reversing
        // again would flip it back and re-create the bug.
        { flexDirection: isRTL && !isWeb ? 'row-reverse' : 'row' },
        contentContainerStyle,
      ]}
    >
      {children}
    </ScrollView>
  );
}
