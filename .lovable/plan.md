## Objetivo

Na página de detalhe do repertório (`/setlists/:id`), cada música da lista deve exibir o tom **atual do usuário** (transposição pessoal salva em `user_song_transpositions`) em vez do tom original quando ele tiver alterado, e mostrar um indicador visual de que o tom foi modificado em relação ao original.

## Comportamento

- Se o usuário **não** transpôs a música: mostra apenas o tom original (como hoje).
- Se transpôs: mostra `Original → NovoTom` com um pequeno badge "modificado" (ou destaque colorido).
- Funciona tanto no modo edição (cards arrastáveis) quanto no modo somente leitura.
- Aplica-se ao próprio dono e a admins de grupo visualizando um repertório compartilhado.
- Sem mudança no banco: usa a tabela `user_song_transpositions` que já existe.

## Implementação técnica

Arquivo: `src/pages/SetlistDetailPage.tsx`

1. **Carregar transposições do usuário para as músicas do setlist**
   - Adicionar `useQuery(["user-transpositions", setlistId, userId, songIds])` que busca:
     ```ts
     supabase.from("user_song_transpositions")
       .select("song_id, semitones, transposed_key")
       .eq("user_id", user.id)
       .in("song_id", songIds)
     ```
   - Construir `Map<song_id, { semitones, transposed_key }>`.
   - Disparar quando `items` mudar; só roda se `songIds.length > 0`.

2. **Helper de exibição** (perto dos outros utilitários do arquivo)
   ```ts
   function renderKeyDisplay(originalKey, userTransp) {
     if (!userTransp || userTransp.semitones === 0) return originalKey;
     return { original: originalKey, current: userTransp.transposed_key };
   }
   ```

3. **Renderização nas duas listas**
   - Card editável (~linha 118) e item somente leitura (~linha 1121): substituir
     ```
     {item.songs?.musical_key && ` · ${item.songs.musical_key}`}
     ```
     por um trecho que, quando há transposição pessoal, mostra:
     ```
     · <span line-through opacity-60>Original</span> → <span text-primary font-medium>NovoTom</span>
     <Badge variant="secondary" class="text-[10px]">modificado</Badge>
     ```
   - Usar tokens semânticos existentes (`text-primary`, `text-muted-foreground`, `Badge` shadcn).

4. **Invalidação**
   - Não há mutações nesta página que alterem a transposição (o salvamento ocorre no Teleprompter / SongDetail). Basta refetch ao montar / quando `items` mudar.
   - Opcional: invalidar `["user-transpositions", setlistId]` ao voltar para a página (`refetchOnWindowFocus: true`).

## Fora do escopo

- Página `/setlists` (lista de repertórios) — não exibe músicas individualmente.
- Página pública (`PublicSetlistPage`) — transposição é pessoal/privada, não se aplica.
- Edição do tom diretamente na lista do repertório (já existe controle `transposed_key` específico do item, separado da transposição pessoal global).
