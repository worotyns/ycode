'use client';

/**
 * Shared TipTap NodeView factory for dynamic variable badges.
 *
 * Creates a DynamicVariable extension with a React-based NodeView that renders
 * an inline badge with optional format selector (for date/number fields).
 *
 * Used by both RichTextEditor (sidebar variant) and CanvasTextEditor (canvas variant).
 */

import React from 'react';
import { createRoot } from 'react-dom/client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';

import { DynamicVariable, getDynamicVariableLabel } from '@/lib/tiptap-extensions/dynamic-variable';
import { isFormattableFieldType } from '@/lib/variable-format-utils';
import VariableFormatSelector from '@/app/ycode/components/VariableFormatSelector';

type VariableViewVariant = 'sidebar' | 'canvas';

const VARIANT_CONFIG = {
  sidebar: {
    badgeVariant: 'secondary' as const,
    deleteButtonVariant: 'outline' as const,
    formatSelectorVariant: 'sidebar' as const,
  },
  canvas: {
    badgeVariant: 'inline_variable_canvas' as const,
    deleteButtonVariant: 'inline_variable_canvas' as const,
    formatSelectorVariant: 'canvas' as const,
  },
};

/**
 * Create a DynamicVariable TipTap extension with a React NodeView.
 * The variant controls visual styling (Badge/Button variants).
 */
export function createDynamicVariableNodeView(variant: VariableViewVariant) {
  const config = VARIANT_CONFIG[variant];

  return DynamicVariable.extend({
    addNodeView() {
      return ({ node: initialNode, getPos, editor }) => {
        const container = document.createElement('span');
        container.className = 'inline-block';
        container.contentEditable = 'false';

        let currentNode = initialNode;
        const variable = currentNode.attrs.variable;
        if (variable) {
          container.setAttribute('data-variable', JSON.stringify(variable));
        }

        const label = getDynamicVariableLabel(currentNode);
        const fieldType = variable?.data?.field_type;
        const isFormattable = isFormattableFieldType(fieldType);

        const handleDelete = () => {
          const pos = getPos();
          if (typeof pos === 'number') {
            editor.chain().focus().deleteRange({ from: pos, to: pos + 1 }).run();
          }
        };

        const handleFormatChange = (formatId: string) => {
          const pos = getPos();
          if (typeof pos === 'number') {
            const currentVariable = currentNode.attrs.variable;
            const updatedVariable = {
              ...currentVariable,
              data: { ...currentVariable.data, format: formatId },
            };
            editor.chain().focus()
              .command(({ tr }) => {
                tr.setNodeMarkup(pos, undefined, {
                  ...currentNode.attrs,
                  variable: updatedVariable,
                });
                return true;
              })
              .run();
          }
        };

        const root = createRoot(container);

        const renderBadge = () => {
          const currentFormat = currentNode.attrs.variable?.data?.format;
          const badgeContent = (
            <Badge variant={config.badgeVariant}>
              <span>{label}</span>
              {editor.isEditable && isFormattable && (
                <Icon
                  name="chevronDown"
                  className="size-2 opacity-60"
                />
              )}
              {editor.isEditable && (
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete();
                  }}
                  className="size-4! p-0! -mr-1"
                  variant={config.deleteButtonVariant}
                >
                  <Icon name="x" className="size-2" />
                </Button>
              )}
            </Badge>
          );

          root.render(
            editor.isEditable && isFormattable ? (
              <VariableFormatSelector
                fieldType={fieldType}
                currentFormat={currentFormat}
                onFormatChange={handleFormatChange}
                variant={config.formatSelectorVariant}
              >
                {badgeContent}
              </VariableFormatSelector>
            ) : badgeContent
          );
        };

        queueMicrotask(renderBadge);

        const updateListener = () => renderBadge();
        editor.on('update', updateListener);

        return {
          dom: container,
          update: (updatedNode) => {
            if (updatedNode.type.name !== 'dynamicVariable') return false;
            currentNode = updatedNode;
            renderBadge();
            return true;
          },
          destroy: () => {
            editor.off('update', updateListener);
            setTimeout(() => root.unmount(), 0);
          },
        };
      };
    },
  });
}
