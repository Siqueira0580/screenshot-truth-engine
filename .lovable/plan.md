## Objetivo
Exibir o nome "Smart Cifra" logo abaixo da imagem do logotipo em todos os locais onde o logo aparece sozinho como bloco visual (telas de marca/identidade), mantendo coerência com o tema claro/escuro.

## Onde aplicar
Locais onde o logo é o elemento central da composição (faz sentido ter o nome embaixo):

1. `src/components/AuthBranding.tsx` — login/registro/recuperação de senha (já mostra o nome ao lado do subtitle, será reposicionado para ficar embaixo do logo).
2. `src/pages/MaintenancePage.tsx` — tela de manutenção.
3. `src/components/TermsInterceptor.tsx` — tela de aceite de termos.
4. `src/pages/LandingPage.tsx` — bloco hero (logo grande redondo).
5. `src/components/AppLayout.tsx` — apenas no menu/drawer lateral onde o logo aparece em destaque (h-12). NÃO incluir no header compacto (h-8) para não poluir a topbar, que já tem o nome ao lado.

## Onde NÃO aplicar
- Header da topbar e do `PublicLayout` — o nome já aparece ao lado do logo (composição horizontal).
- Favicon e ícones PWA — são imagens puras.

## Estilo
- Texto: "Smart" em `text-foreground` + "Cifra" em `text-primary` (mesmo padrão já usado em `AuthBranding`).
- Tamanho proporcional ao logo: `text-xs` para logos h-8, `text-sm` para h-9/h-12, `text-base font-bold` para h-16.
- Espaçamento: `mt-1.5` a `mt-2` entre logo e texto, com `flex flex-col items-center`.
- Tracking apertado (`tracking-tight`) para identidade.

## Detalhes técnicos
- Substituir cada `<img …logo… />` por um wrapper `<div className="flex flex-col items-center gap-1.5">` contendo a img + um `<span>` com o nome.
- Em `AuthBranding`, remover o `<h1>` atual com o nome e passar o nome para baixo do logo; manter o subtitle abaixo.
- Não criar componente novo (uso pontual em 5 arquivos, mais simples manter inline e respeitar tamanhos diferentes).