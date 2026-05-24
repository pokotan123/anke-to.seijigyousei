/**
 * @module reorder
 * @layer util
 *
 * 配列内の要素を1つ上/下に移動した新しい配列を返す純粋関数。
 *
 * 質問・選択肢の並び替えで使用する。呼び出し側は戻り値の配列を
 * インデックス順に走査して order を 1..N で振り直す（再採番方式）想定。
 * これにより、既存データの order が重複・欠落していても、移動操作の
 * たびに正しい連番へ自己修復される。
 */

/** 移動方向 */
export type MoveDirection = 'up' | 'down';

/**
 * `items` の `index` 番目の要素を `direction` 方向へ1つ移動した新配列を返す。
 * 端や範囲外で移動できない場合は、元の配列をそのまま（同一参照で）返す。
 * 呼び出し側は `result === items` で「移動なし」を判定できる。
 */
export function reorder<T>(items: T[], index: number, direction: MoveDirection): T[] {
  const target = direction === 'up' ? index - 1 : index + 1;
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) {
    return items;
  }
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
