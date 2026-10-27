/**
 * Size a web `<textarea>` to its content.
 *
 * react-native-web renders a multiline `TextInput` as a `<textarea>` with
 * HTML's default of two rows and no growing: the chat composer's empty field
 * was two rows tall with its placeholder on the top row and the `+` / send
 * buttons level with the empty one below. The composer passes `rows={1}` and
 * calls this after every change, so the field is one line when empty and grows
 * with what is typed. `max-height` in the field's style does the clamping, and
 * the textarea scrolls inside it past that.
 *
 * `height` goes back to `auto` before `scrollHeight` is read. A textarea given
 * an explicit height reports at least that height, so measuring without the
 * reset can grow the field but never shrink it once the text is sent.
 *
 * Takes the node structurally so it needs no DOM types and does nothing where
 * there is no DOM node (a native build hands the ref to `TextInput`, which has
 * no `style` object to write to).
 */
export type SizableTextarea = {
  style: { height: string };
  scrollHeight: number;
};

export function fitTextareaHeight(node: SizableTextarea | null | undefined): void {
  if (!node || typeof node !== 'object' || !node.style) return;
  node.style.height = 'auto';
  node.style.height = `${node.scrollHeight}px`;
}
