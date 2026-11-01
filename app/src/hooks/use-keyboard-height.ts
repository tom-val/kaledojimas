import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * How far the keyboard reaches up from the bottom of the screen, 0 when closed. The app draws
 * edge to edge, so Android doesn't resize the screen for the keyboard and the layout has to.
 */
export function useKeyboardHeight() {
  const insets = useSafeAreaInsets();
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', (e) =>
      setHeight(e.endCoordinates.height),
    );
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // Android reports the height above the navigation bar, iOS from the screen edge.
  return height > 0 && Platform.OS === 'android' ? height + insets.bottom : height;
}
