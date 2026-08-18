import { MessageFlags, type RepliableInteraction } from "discord.js";
import { errorEmbed } from "./embeds/error.embed.js";

type ReplyErrorMode =
  /** Edit an existing deferred/replied response — clears prior content and components. */
  | "editReply"
  /** Send a brand-new follow-up message — for an interaction that was
   * acknowledged via `showModal()`, which discord.js doesn't count as
   * "replied", so `editReply`/`reply` would both be invalid here. */
  | "followUp"
  /** Branch on `interaction.deferred || interaction.replied` at call time —
   * for a modalSubmit interaction whose state depends on how far the
   * surrounding flow got before failing. */
  | "auto";

interface ReplyWithErrorOptions {
  mode?: ReplyErrorMode;
  /** Wrap the reply in `.catch(() => undefined)` — for interactions that may
   * have already expired or been replied to elsewhere. */
  swallow?: boolean;
  /** Message shown when `error` isn't an `Error` instance. Commands differ
   * on this (e.g. "Something went wrong." vs "The request timed out."), so
   * it's required rather than a single shared default. */
  fallbackMessage: string;
}

/** Reports a caught error back to the user as an error embed. */
export async function replyWithError(
  interaction: RepliableInteraction,
  error: unknown,
  opts: ReplyWithErrorOptions,
): Promise<void> {
  const message = error instanceof Error ? error.message : opts.fallbackMessage;
  const embeds = [errorEmbed(message)];

  const mode = opts.mode ?? "auto";
  const useEditReply = mode === "editReply" || (mode === "auto" && (interaction.deferred || interaction.replied));

  const send =
    mode === "followUp"
      ? interaction.followUp({ embeds, flags: MessageFlags.Ephemeral })
      : useEditReply
        ? interaction.editReply({ content: null, embeds, components: [] })
        : interaction.reply({ embeds, flags: MessageFlags.Ephemeral });

  await (opts.swallow ? send.catch(() => undefined) : send);
}
