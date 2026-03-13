import BackButton from "@/components/ui/BackButton";

export default function TermsOfUsePage() {
  return (
    <div className="px-4 py-8 md:px-8 md:py-12 max-w-3xl mx-auto">
      <BackButton className="mb-6" />

      <article className="prose prose-sm sm:prose-base dark:prose-invert max-w-none">
        <h1>Termos de Uso e Política de Privacidade</h1>
        <p><strong>Última atualização:</strong> 13 de Março de 2026</p>
        <p>
          Bem-vindo ao nosso aplicativo de organização de repertórios musicais e cifras. Ao criar uma conta e utilizar os nossos serviços, você concorda com os termos e condições descritos abaixo. Se você não concorda com qualquer parte destes termos, não deve utilizar o sistema.
        </p>

        <h3>1. O Serviço e o Propósito</h3>
        <p>
          A nossa plataforma é uma ferramenta digital projetada para auxiliar músicos, bandas e artistas a organizar os seus próprios repertórios (setlists), transcrever acordes e facilitar os ensaios. Nós fornecemos a tecnologia (o "caderno digital"), mas não somos uma editora musical ou distribuidores de conteúdo protegido.
        </p>

        <h3>2. Responsabilidade sobre o Conteúdo e Direitos Autorais</h3>
        <ul>
          <li><strong>Conteúdo do Utilizador:</strong> Você é o único e exclusivo responsável por qualquer texto, letra, cifra, arquivo (PDF) ou informação que digitar, importar ou fizer upload na plataforma.</li>
          <li><strong>Uso Pessoal:</strong> As cifras e letras inseridas por si devem destinar-se ao seu uso pessoal, educacional ou profissional (apresentações ao vivo), respeitando as leis de direitos autorais vigentes.</li>
          <li><strong>Ausência de Endosso:</strong> Nós não monitorizamos proativamente, não endossamos e não assumimos qualquer responsabilidade legal sobre o conteúdo que os utilizadores guardam nos seus perfis privados ou compartilham via link.</li>
          <li><strong>Remoção de Conteúdo:</strong> Reservamo-nos o direito de remover qualquer conteúdo ou encerrar contas que comprovadamente violem direitos de propriedade intelectual de terceiros ou utilizem o sistema para fins ilícitos.</li>
        </ul>

        <h3>3. Compartilhamento de Repertórios (Setlists)</h3>
        <ul>
          <li>Ao utilizar a função de "Compartilhar Repertório", o sistema gera um link público.</li>
          <li>Você compreende e aceita que qualquer pessoa com acesso a este link poderá visualizar as músicas, os tons e as datas contidas nesse repertório específico.</li>
          <li>O sistema garante que os visitantes do link público não terão acesso à sua conta pessoal, aos seus dados de login ou a outras composições e repertórios que não foram explicitamente compartilhados.</li>
        </ul>

        <h3>4. Privacidade e Proteção de Dados (LGPD)</h3>
        <p>Levamos a sua privacidade a sério. Os dados coletados são utilizados exclusivamente para o funcionamento do sistema:</p>
        <ul>
          <li><strong>Dados Coletados:</strong> Solicitamos Nome, Sobrenome, E-mail e Telefone estritamente para criação de conta, recuperação de senha e comunicação essencial sobre o serviço.</li>
          <li><strong>Segurança:</strong> As suas senhas são criptografadas (não temos acesso a elas) e utilizamos tecnologias avançadas (como proteção contra senhas vazadas e regras de segurança de banco de dados) para proteger a sua conta.</li>
          <li><strong>Não Comercialização:</strong> Nós nunca venderemos, alugaremos ou compartilharemos os seus dados pessoais de contacto com empresas terceiras para fins de marketing.</li>
        </ul>

        <h3>5. Regras de Conduta</h3>
        <p>Ao usar o aplicativo, você concorda em <strong>NÃO</strong>:</p>
        <ul>
          <li>Tentar burlar as regras de segurança do sistema (hacking, scraping ou injeção de código).</li>
          <li>Fazer upload de arquivos PDF corrompidos, com vírus ou que não sejam relacionados ao propósito musical do aplicativo.</li>
          <li>Criar contas falsas ou tentar acessar áreas do sistema e convites que não lhe pertencem.</li>
        </ul>

        <h3>6. Limitação de Responsabilidade</h3>
        <p>
          O serviço é fornecido "no estado em que se encontra" (as is). Embora trabalhemos arduamente para manter o sistema sempre rápido, seguro e online, não podemos garantir que a plataforma será 100% livre de interrupções ou erros.
        </p>
        <p>
          Não nos responsabilizamos por eventuais falhas de conexão, perda de dados não intencional ou problemas decorrentes do uso do aplicativo durante apresentações ao vivo. Recomendamos que tenha sempre um backup (como a exportação em PDF) para os seus shows críticos.
        </p>

        <h3>7. Alterações nos Termos</h3>
        <p>
          Podemos atualizar estes Termos de Uso periodicamente para refletir novas funcionalidades do sistema. Quando isso acontecer, a data de "Última atualização" no topo desta página será alterada. O uso contínuo do aplicativo após as alterações constitui a sua aceitação dos novos termos.
        </p>
      </article>
    </div>
  );
}
