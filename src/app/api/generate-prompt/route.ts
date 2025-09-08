import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

interface FormData {
  profession: string;
  colorPalette: string;
  visualStyle: string;
  subject: string;
  theme: string;
  quantity: number;
  logo?: File;
  customText?: string;
  referenceImage?: File;
  artStyle: string;
  platform: string;
}

const platformSpecifics: Record<string, string> = {
  "instagram": "Formato quadrado (1:1) para feed, formato vertical (9:16) para stories",
  "facebook": "Formato quadrado (1:1) para feed, formato vertical (9:16) para stories",
  "tiktok": "Formato vertical (9:16) otimizado para vídeos curtos",
  "whatsapp": "Formato circular para status, formato vertical (9:16)"
};

export async function POST(request: NextRequest) {
  try {
    // Handle both FormData and JSON
    const contentType = request.headers.get('content-type');
    let body: FormData;

    if (contentType?.includes('multipart/form-data')) {
      const formData = await request.formData();
      body = {
        profession: formData.get('profession') as string,
        colorPalette: formData.get('colorPalette') as string,
        visualStyle: formData.get('visualStyle') as string,
        subject: formData.get('subject') as string,
        theme: formData.get('theme') as string,
        quantity: parseInt(formData.get('quantity') as string) || 1,
        logo: formData.get('logo') as File,
        customText: formData.get('customText') as string,
        referenceImage: formData.get('referenceImage') as File,
        artStyle: formData.get('artStyle') as string,
        platform: formData.get('platform') as string || 'instagram'
      };
    } else {
      body = await request.json() as FormData;
    }
    
    // Validate required fields
    if (!body.profession || !body.colorPalette || !body.visualStyle || !body.subject || !body.theme) {
      return NextResponse.json(
        { error: 'Todos os campos são obrigatórios' },
        { status: 400 }
      );
    }

    // Initialize ZAI client
    const zai = await ZAI.create();

    // Create the enhanced prompt for GLM 4.5
    const systemPrompt = `Você é um especialista em criação de conteúdo para redes sociais com foco em engajamento e conversão. Sua tarefa é gerar prompts otimizados para criar conteúdo de alta qualidade para diferentes plataformas.

Formato esperado:
"Crie um [tipo de conteúdo] para [Profissão], no estilo [Estilo], utilizando a paleta de cores [Paleta de Cores]. O assunto principal é [Assunto] e o tema é [Tema]. Gere [Quantidade de posts] posts com foco em engajamento, design criativo e conteúdo relevante para o público-alvo. O tom deve ser [Tom baseado no estilo]."

Instruções específicas:
1. Adicione detalhes específicos e relevantes para a profissão informada
2. Sugira elementos visuais específicos que funcionam bem com o estilo escolhido
3. Inclua dicas de engajamento específicas para o tema
4. Adicione sugestões de hashtags relevantes
5. Inclua orientações sobre layout e composição visual
6. Sugira estratégias de call-to-action
7. Adicione dicas de timing e frequência de postagem
8. Inclua sugestões de interação com a audiência
9. Ajuste o prompt para a plataforma específica selecionada
10. Inclua referências ao estilo da arte solicitado
11. Se houver logotipo, sugira como integrá-lo visualmente
12. Se houver imagem de referência, sugira elementos inspirados nela
13. Se houver texto personalizado, sugira como incorporá-lo visualmente
14. Adicione especificações técnicas para a plataforma`;

    const platformInfo = platformSpecifics[body.platform] || "Formato padrão";
    const logoInfo = body.logo ? "Incluir logotipo da marca de forma sutil e profissional" : "Sem logotipo específico";
    const referenceInfo = body.referenceImage ? "Inspirar-se na imagem de referência mantendo a essência do estilo" : "Sem referência visual específica";
    const customTextInfo = body.customText ? `Incorporar o texto: "${body.customText}" de forma visualmente atraente` : "Sem texto personalizado específico";

    const userPrompt = `
Profissão: ${body.profession}
Paleta de Cores: ${body.colorPalette}
Estilo Visual: ${body.visualStyle}
Estilo da Arte: ${body.artStyle || "Não especificado"}
Assunto Principal: ${body.subject}
Tema: ${body.theme}
Quantidade de Posts: ${body.quantity}
Plataforma: ${body.platform}
Formato da Plataforma: ${platformInfo}

${logoInfo}
${referenceInfo}
${customTextInfo}

Por favor, gere um prompt otimizado seguindo o formato e instruções acima, considerando todos os elementos específicos fornecidos.
`;

    // Generate the prompt using GLM 4.5
    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: userPrompt
        }
      ],
      temperature: 0.7,
      max_tokens: 1200,
      model: 'glm-4'
    });

    const generatedPrompt = completion.choices[0]?.message?.content;

    if (!generatedPrompt) {
      throw new Error('Não foi possível gerar o prompt');
    }

    // Format the final response
    const formattedPrompt = `Prompt Gerado: ${generatedPrompt}`;

    return NextResponse.json({
      prompt: formattedPrompt,
      success: true,
      platform: body.platform,
      logo: !!body.logo,
      referenceImage: !!body.referenceImage,
      customText: !!body.customText
    });

  } catch (error) {
    console.error('Error generating prompt:', error);
    
    // Fallback to a basic prompt generation if AI fails
    const platformInfo = platformSpecifics[body.platform] || "Formato padrão";
    const tone = getToneBasedOnStyle(body.visualStyle);
    
    const fallbackPrompt = `Prompt Gerado: Crie um conteúdo para ${body.profession}, no estilo ${body.visualStyle}, utilizando a paleta de cores ${body.colorPalette}. O assunto principal é ${body.subject} e o tema é ${body.theme}. Gere ${body.quantity} posts com foco em engajamento, design criativo e conteúdo relevante para o público-alvo. O tom deve ser ${tone}. Formato: ${platformInfo}. ${body.artStyle ? `Estilo da arte: ${body.artStyle}.` : ''} ${body.logo ? 'Incluir logotipo da marca.' : ''} ${body.referenceImage ? 'Inspirar-se em referências visuais.' : ''} ${body.customText ? `Texto personalizado: ${body.customText}.` : ''}`;

    return NextResponse.json({
      prompt: fallbackPrompt,
      success: true,
      note: 'Usando modo de fallback - API de IA temporariamente indisponível'
    });
  }
}

function getToneBasedOnStyle(style: string): string {
  const toneMap: Record<string, string> = {
    "Minimalista": "Profissional", "Futurista": "Inovador", "Vintage": "Nostálgico",
    "Luxuoso": "Elegante", "Moderno": "Contemporâneo", "Clássico": "Profissional",
    "Industrial": "Sério", "Boêmio": "Divertido", "Retrô": "Nostálgico",
    "Contemporâneo": "Profissional", "Artístico": "Criativo", "Profissional": "Profissional",
    "Divertido": "Divertido", "Sério": "Profissional", "Criativo": "Criativo",
    "Elegante": "Elegante", "Casual": "Divertido", "Formal": "Profissional",
    "Informal": "Divertido", "Sophisticated": "Profissional", "Playful": "Divertido",
    "Bold": "Inovador", "Subtle": "Profissional", "Vibrant": "Criativo",
    "Monochromatic": "Profissional", "Gradient": "Criativo", "Flat": "Profissional",
    "3D": "Inovador", "Neon": "Criativo", "Dark Mode": "Profissional", "Light Mode": "Profissional"
  };

  return toneMap[style] || "Profissional";
}