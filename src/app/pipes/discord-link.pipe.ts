import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Pipe({
  name: 'discordLink',
  standalone: true
})
export class DiscordLinkPipe implements PipeTransform {

  constructor(private sanitizer: DomSanitizer) {}

  transform(value: string): SafeHtml {
    if (!value) return value;

    // Regex to match various obfuscated discord.gg links
    // Matches "discord", followed by separators (dot, fullwidth dot, space), "gg", separators (slash, fullwidth slash, space), and the code
    const regex = /discord[\s\.\．]*gg[\s\/\／]*([a-zA-Z0-9]+)/gi;

    const linked = value.replace(regex, (match, code) => {
      return `<a href="https://discord.gg/${code}" target="_blank" class="discord-link" onclick="event.stopPropagation()">discord.gg/${code}</a>`;
    });

    return this.sanitizer.bypassSecurityTrustHtml(linked);
  }
}
