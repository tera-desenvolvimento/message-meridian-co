import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { TemplateEntry } from "./registry";

const SITE_NAME = "Crmly";

interface InvitationEmailProps {
  workspaceName?: string;
  inviterName?: string;
  role?: "ADMIN" | "AGENT";
  inviteUrl?: string;
}

const roleLabel = (role?: string) =>
  role === "ADMIN" ? "Administrador" : "Agente";

const InvitationEmail = ({
  workspaceName = "sua equipe",
  inviterName,
  role = "AGENT",
  inviteUrl = "#",
}: InvitationEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>
      Você foi convidado para participar de {workspaceName} no {SITE_NAME}
    </Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Você recebeu um convite</Heading>
        <Text style={text}>
          {inviterName ? `${inviterName} convidou você` : "Você foi convidado"}{" "}
          para participar da equipe <strong>{workspaceName}</strong> no{" "}
          {SITE_NAME} como <strong>{roleLabel(role)}</strong>.
        </Text>
        <Text style={text}>
          Clique no botão abaixo para criar sua conta e entrar diretamente no
          workspace. O convite é válido por 7 dias.
        </Text>
        <Section style={{ textAlign: "center", margin: "32px 0" }}>
          <Button href={inviteUrl} style={button}>
            Aceitar convite
          </Button>
        </Section>
        <Text style={small}>
          Se o botão não funcionar, copie e cole este link no navegador:
          <br />
          <span style={linkText}>{inviteUrl}</span>
        </Text>
        <Text style={footer}>
          Se você não esperava este convite, pode ignorar este e-mail
          tranquilamente.
        </Text>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: InvitationEmail,
  subject: (data: Record<string, any>) =>
    `Convite para ${data.workspaceName ?? "uma equipe"} no ${SITE_NAME}`,
  displayName: "Convite de equipe",
  previewData: {
    workspaceName: "Tera",
    inviterName: "Alessandro",
    role: "ADMIN",
    inviteUrl: "https://example.com/accept-invite?token=preview",
  },
} satisfies TemplateEntry;

const main = {
  backgroundColor: "#ffffff",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif",
};
const container = {
  padding: "32px 28px",
  maxWidth: "560px",
  margin: "0 auto",
};
const h1 = {
  fontSize: "22px",
  fontWeight: 700,
  color: "#0f172a",
  margin: "0 0 20px",
};
const text = {
  fontSize: "15px",
  color: "#334155",
  lineHeight: "1.6",
  margin: "0 0 16px",
};
const button = {
  backgroundColor: "#0f172a",
  color: "#ffffff",
  padding: "12px 24px",
  borderRadius: "8px",
  fontSize: "14px",
  fontWeight: 600,
  textDecoration: "none",
  display: "inline-block",
};
const small = {
  fontSize: "12px",
  color: "#64748b",
  lineHeight: "1.5",
  margin: "24px 0 0",
};
const linkText = {
  wordBreak: "break-all" as const,
  color: "#0f172a",
};
const footer = {
  fontSize: "12px",
  color: "#94a3b8",
  margin: "32px 0 0",
};
