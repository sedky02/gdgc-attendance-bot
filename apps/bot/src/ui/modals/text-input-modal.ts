import {
  LabelBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ChatInputCommandInteraction,
  type MessageComponentInteraction,
  type ModalSubmitInteraction,
} from "discord.js";

/** The interaction kinds discord.js actually allows to call `showModal()` on. */
type ModalTriggerInteraction = ChatInputCommandInteraction | MessageComponentInteraction;

interface SingleFieldModalOptions {
  customId: string;
  title: string;
  label: string;
  fieldId: string;
  style?: TextInputStyle;
  maxLength?: number;
  required?: boolean;
  /** Pre-fills the field — used by /edit-meeting-type to show the current name. */
  value?: string;
}

/** Builds a modal with exactly one labeled text field, via the Components v2
 * `LabelBuilder` API (not the deprecated `TextInputBuilder.setLabel` /
 * `ModalBuilder.addComponents`). */
export function buildSingleFieldModal(opts: SingleFieldModalOptions): ModalBuilder {
  const textInput = new TextInputBuilder()
    .setCustomId(opts.fieldId)
    .setStyle(opts.style ?? TextInputStyle.Short)
    .setRequired(opts.required ?? true);

  if (opts.maxLength !== undefined) {
    textInput.setMaxLength(opts.maxLength);
  }
  if (opts.value !== undefined) {
    textInput.setValue(opts.value);
  }

  return new ModalBuilder()
    .setCustomId(opts.customId)
    .setTitle(opts.title)
    .addLabelComponents(new LabelBuilder().setLabel(opts.label).setTextInputComponent(textInput));
}

/**
 * Shows the modal and awaits its submission, scoped to the user who
 * triggered `interaction`. Rejects on timeout — same as
 * `awaitModalSubmit`/`awaitMessageComponent` — so callers keep their
 * existing try/catch around this call.
 */
export async function awaitModal(
  interaction: ModalTriggerInteraction,
  modal: ModalBuilder,
  timeoutMs: number,
): Promise<ModalSubmitInteraction> {
  await interaction.showModal(modal);

  return interaction.awaitModalSubmit({
    filter: (i) => i.customId === modal.data.custom_id && i.user.id === interaction.user.id,
    time: timeoutMs,
  });
}
