"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";

function normalizeChoiceInput(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

export default function AttributeEditor({
  attribute,
  index,
  onChange,
  onRemove,
  onAddValue,
  onRemoveValue,
  errors,
}) {
  const [draftChoice, setDraftChoice] = useState("");
  const [isAddingChoice, setIsAddingChoice] = useState(false);
  const [editingChoiceIndex, setEditingChoiceIndex] = useState(null);
  const [editingChoiceValue, setEditingChoiceValue] = useState("");

  const values = Array.isArray(attribute.values) ? attribute.values : [];

  const commitNewChoice = () => {
    const nextValue = normalizeChoiceInput(draftChoice);
    if (!nextValue) {
      setDraftChoice("");
      setIsAddingChoice(false);
      return;
    }
    onAddValue(nextValue);
    setDraftChoice("");
    setIsAddingChoice(false);
  };

  const commitEditedChoice = () => {
    if (editingChoiceIndex === null) return;
    const nextValue = normalizeChoiceInput(editingChoiceValue);
    if (!nextValue) return;

    const nextValues = [...values];
    nextValues[editingChoiceIndex] = {
      ...nextValues[editingChoiceIndex],
      value: nextValue,
    };
    onChange({ ...attribute, values: nextValues });
    setEditingChoiceIndex(null);
    setEditingChoiceValue("");
  };

  return (
    <div className="space-y-4 border-t border-slate-100 pt-5 first:border-t-0 first:pt-0">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
        <div>
          <label className="text-sm font-medium text-slate-700">Option name</label>
          <input
            className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
            placeholder={index === 0 ? "Size" : "Color"}
            value={attribute.name}
            onChange={(event) => onChange({ ...attribute, name: event.target.value })}
          />
          {errors?.name ? (
            <p className="mt-2 text-xs text-rose-600">{errors.name}</p>
          ) : null}
        </div>

        <button
          type="button"
          onClick={onRemove}
          className="inline-flex h-10 items-center justify-center rounded-lg px-2 text-sm font-medium text-slate-500 transition hover:text-slate-900 md:mt-7"
        >
          Remove
        </button>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700">Choices</label>
        <div className="flex flex-wrap items-center gap-2.5">
          {values.map((valueRow, valueIndex) =>
            editingChoiceIndex === valueIndex ? (
              <input
                key={valueRow.id || `${index}-${valueIndex}`}
                autoFocus
                className="h-8 min-w-[88px] rounded-lg border border-slate-300 bg-white px-2.5 text-sm text-slate-900 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
                value={editingChoiceValue}
                onChange={(event) => setEditingChoiceValue(event.target.value)}
                onBlur={commitEditedChoice}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    commitEditedChoice();
                  }
                  if (event.key === "Escape") {
                    setEditingChoiceIndex(null);
                    setEditingChoiceValue("");
                  }
                }}
              />
            ) : (
              <div
                key={valueRow.id || `${index}-${valueIndex}`}
                className="inline-flex h-8 items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 text-sm text-slate-700"
              >
                <button
                  type="button"
                  onClick={() => {
                    setEditingChoiceIndex(valueIndex);
                    setEditingChoiceValue(valueRow.value || "");
                  }}
                  className="transition hover:text-slate-900"
                >
                  {valueRow.value}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (editingChoiceIndex === valueIndex) {
                      setEditingChoiceIndex(null);
                      setEditingChoiceValue("");
                    }
                    onRemoveValue(valueIndex);
                  }}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  aria-label={`Remove ${attribute.name || "option"} choice ${valueIndex + 1}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )
          )}

          {isAddingChoice ? (
            <input
              autoFocus
              className="h-8 min-w-[96px] rounded-lg border border-slate-300 bg-white px-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
              placeholder="Add choice"
              value={draftChoice}
              onChange={(event) => setDraftChoice(event.target.value)}
              onBlur={commitNewChoice}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  commitNewChoice();
                }
                if (event.key === "Escape") {
                  setDraftChoice("");
                  setIsAddingChoice(false);
                }
              }}
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                setEditingChoiceIndex(null);
                setDraftChoice("");
                setIsAddingChoice(true);
              }}
              className="inline-flex h-8 items-center gap-1 rounded-md border border-dashed border-slate-300 px-2.5 text-sm font-medium text-slate-600 transition hover:border-slate-400 hover:text-slate-900"
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </button>
          )}
        </div>

        {errors?.values?.some?.((valueError) => valueError?.value) ? (
          <div className="space-y-1">
            {errors.values.map((valueError, valueIndex) =>
              valueError?.value ? (
                <p
                  key={`choice-error-${valueIndex}`}
                  className="text-xs text-rose-600"
                >
                  {valueError.value}
                </p>
              ) : null
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
