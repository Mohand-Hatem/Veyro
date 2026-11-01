"use client";

import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type RefObject, type SyntheticEvent } from "react";
import { useTranslations } from "next-intl";
import { Avatar } from "@/components/ui/avatar";
import { avatarClass } from "@/lib/dashboard";
import { mentionQuery, nameMatches, toTokens, type Mentionable } from "@/lib/mentions";
import { usePersonName } from "@/lib/person";
import "./mention.css";

export type MentionPerson = Mentionable & { avatarUrl: string | null; role: "ADMIN" | "MEMBER" };

const MAX_SHOWN = 6;

/**
 * The @ picker of a text box (a combobox: the box keeps focus, the list follows with aria-activedescendant).
 * It opens while "@name" is being typed, arrows and Enter or Tab pick, Escape closes, and the people picked in this
 * draft are kept so `encode` can turn "@Name" into the token the server stores. The caller owns the textarea's ref.
 */
export function useMentionPicker(ref: RefObject<HTMLTextAreaElement | null>, people: MentionPerson[], value: string, setValue: (v: string) => void) {
  const t = useTranslations("Task");
  const tb = useTranslations("Board");
  const pn = usePersonName();
  const listId = useId();
  const [typed, setTyped] = useState<{ start: number; query: string } | null>(null);
  const [active, setActive] = useState(0);
  const [picked, setPicked] = useState<Mentionable[]>([]);
  // Where the caret goes after a pick. Set before the browser paints the new text: a frame later, a fast typist's
  // next letters would already have landed at the wrong place.
  const caretAfterPick = useRef<number | null>(null);
  useLayoutEffect(() => {
    const at = caretAfterPick.current;
    if (at === null || !ref.current) return;
    caretAfterPick.current = null;
    ref.current.focus();
    ref.current.setSelectionRange(at, at);
  }, [value, ref]);

  const matches = typed ? people.filter((p) => nameMatches(p.name, typed.query)).slice(0, MAX_SHOWN) : [];
  const open = matches.length > 0;
  const current = Math.min(active, Math.max(matches.length - 1, 0));

  const follow = (e: SyntheticEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    const next = mentionQuery(el.value, el.selectionStart ?? el.value.length);
    if (next?.start !== typed?.start || next?.query !== typed?.query) setActive(0);
    setTyped(next);
  };

  function pick(p: MentionPerson) {
    const el = ref.current;
    if (!el || !typed) return;
    const insert = `@${p.name} `;
    const before = value.slice(0, typed.start);
    setValue(before + insert + value.slice(el.selectionStart ?? value.length));
    setPicked((l) => (l.some((x) => x.id === p.id) ? l : [...l, p]));
    setTyped(null);
    caretAfterPick.current = before.length + insert.length;
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!open) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setActive((current + (e.key === "ArrowDown" ? 1 : -1) + matches.length) % matches.length);
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      pick(matches[current]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation(); // closes the list, not the dialog around it
      setTyped(null);
    }
  };

  const optionId = (i: number) => `${listId}-${i}`;
  return {
    /** Spread on the textarea. */
    bind: {
      onKeyDown,
      onSelect: follow,
      onBlur: () => setTyped(null),
      role: "combobox" as const,
      "aria-autocomplete": "list" as const,
      "aria-expanded": open,
      "aria-controls": open ? listId : undefined,
      "aria-activedescendant": open ? optionId(current) : undefined,
    },
    menu: open ? (
      <ul className="mn-list" id={listId} role="listbox" aria-label={t("mentionList")}>
        {matches.map((p, i) => (
          <li
            key={p.id}
            id={optionId(i)}
            role="option"
            aria-selected={i === current}
            className={i === current ? "is-on" : undefined}
            onMouseDown={(e) => e.preventDefault()} // keeps the focus (and the list) in the text box
            onMouseEnter={() => setActive(i)}
            onClick={() => pick(p)}
          >
            <Avatar className={`bd-av ${avatarClass(p.id)}`} name={p.name} url={p.avatarUrl} />
            <span className="mn-name" dir="auto">{pn(p.name)}</span>
            <span className="mn-role">{tb(`pr${p.role}`)}</span>
          </li>
        ))}
      </ul>
    ) : null,
    /** The text as the server should store it; then forget the picks. */
    encode: (text: string) => toTokens(text, picked),
    reset: () => setPicked([]),
  };
}
