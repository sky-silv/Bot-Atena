require('dotenv').config();
const { 
  Client, 
  GatewayIntentBits, 
  Events, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle 
} = require('discord.js');
const Groq = require('groq-sdk');
const fs = require('fs');
const path = require('path');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Arquivos de banco de dados locais
const CAMINHO_PLACAR_GTS = path.join(__dirname, 'placar.json');
const CAMINHO_QUIZ_MEMBROS = path.join(__dirname, 'ranking_quiz.json');

// --- DADOS DOS GTS ---
const placarInicialGTs = {
  academicos: { nome: 'GT Assuntos Acadêmicos', pontos: 0 },
  rh: { nome: 'GT Recursos Humanos', pontos: 0 },
  marketing: { nome: 'GT Comunicação e Marketing', pontos: 0 },
  superintendencia: { nome: 'GT Superintendência', pontos: 0 }
};

function carregarPlacarGTs() {
  if (!fs.existsSync(CAMINHO_PLACAR_GTS)) {
    fs.writeFileSync(CAMINHO_PLACAR_GTS, JSON.stringify(placarInicialGTs, null, 2));
    return placarInicialGTs;
  }
  try { return JSON.parse(fs.readFileSync(CAMINHO_PLACAR_GTS, 'utf8')); } 
  catch (err) { return placarInicialGTs; }
}
function salvarPlacarGTs(dados) { fs.writeFileSync(CAMINHO_PLACAR_GTS, JSON.stringify(dados, null, 2)); }

// --- DADOS DO QUIZ SEMANAL DE MEMBROS ---
function carregarQuizMembros() {
  if (!fs.existsSync(CAMINHO_QUIZ_MEMBROS)) {
    fs.writeFileSync(CAMINHO_QUIZ_MEMBROS, JSON.stringify({}, null, 2));
    return {};
  }
  try { return JSON.parse(fs.readFileSync(CAMINHO_QUIZ_MEMBROS, 'utf8')); } 
  catch (err) { return {}; }
}
function salvarQuizMembros(dados) { fs.writeFileSync(CAMINHO_QUIZ_MEMBROS, JSON.stringify(dados, null, 2)); }

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once(Events.ClientReady, (c) => {
  console.log(`🦉 Atena (${c.user.tag}) está pronta com Quiz Gerado por IA!`);
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;

  const prefixo = '!atena';
  const foiMencionado = message.mentions.has(client.user);

  if (!message.content.toLowerCase().startsWith(prefixo) && !foiMencionado) return;

  const regexMencao = new RegExp(`<@!?${client.user.id}>`, 'g');
  const regexPrefixo = new RegExp(`^${prefixo}`, 'gi');

  let pergunta = message.content.replace(regexPrefixo, '').replace(regexMencao, '').trim();

  if (!pergunta) {
    return message.reply('Olá! Sou a **Atena**, uma IA criada pelo **Crea-GO Jovem**. Como posso te ajudar nos estudos, dúvidas técnicas ou no Quiz da semana?');
  }

  const textoLimpo = pergunta.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, '').trim();

  // --- PIADAS E EASTER EGGS ---
  if (textoLimpo.includes('mais mais')) return message.reply('O homem, uma maquina o expert em dar trabalho o...🥁🥁 Sky');
  if (textoLimpo.includes('rainha')) return message.reply('A LARA, quem é que manda, A LARA');
  if (textoLimpo.includes('melhor gt')) return message.reply('o liderado pela Bruna e a Lauriane');
  if (textoLimpo.includes('mais enjoado')) return message.reply('O implicante do Whygner');

  // --- COMPONENTES DO QUIZ DA SEMANA ---

  // 1. INICIAR UMA RODADA DO QUIZ GERADA POR IA: !atena quiz
  if (textoLimpo === 'quiz') {
    try {
      await message.channel.sendTyping();

      // Pede para o Groq gerar uma pergunta em formato JSON válido
      const promptQuiz = 
        'Gere uma pergunta de múltipla escolha inédita sobre Engenharia, Agronomia, Geociências, ABNT, legislação do Confea/Crea ou física/matemática básica. ' +
        'Retorne ESTRITAMENTE um JSON no seguinte formato, sem formatação markdown ou texto adicional:\n' +
        '{\n' +
        '  "pergunta": "Texto da pergunta aqui",\n' +
        '  "opcoes": ["Opção 0", "Opção 1", "Opção 2", "Opção 3"],\n' +
        '  "correta": 0\n' +
        '}\n' +
        'O campo "correta" deve ser o número do índice correto (0 para a primeira opção, 1 para a segunda, etc).';

      const completion = await groq.chat.completions.create({
        messages: [{ role: 'user', content: promptQuiz }],
        model: 'llama-3.3-70b-versatile',
        temperature: 0.8,
      });

      const rawContent = completion.choices[0]?.message?.content || '';
      // Limpa possíveis blocos de código markdown como ```json ... ```
      const jsonString = rawContent.replace(/```json/g, '').replace(/```/g, '').trim();
      const quizItem = JSON.parse(jsonString);

      const embed = new EmbedBuilder()
        .setColor(0x3498DB)
        .setTitle('🧠 QUIZ DA ATENA - PERGUNTA INÉDITA')
        .setDescription(`**${quizItem.pergunta}**\n\n` +
                        `**A)** ${quizItem.opcoes[0]}\n` +
                        `**B)** ${quizItem.opcoes[1]}\n` +
                        `**C)** ${quizItem.opcoes[2]}\n` +
                        `**D)** ${quizItem.opcoes[3]}`)
        .setFooter({ text: 'Clique no botão com a resposta correta! (+10 pontos)' });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`quiz_0_${quizItem.correta}`).setLabel('A').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`quiz_1_${quizItem.correta}`).setLabel('B').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`quiz_2_${quizItem.correta}`).setLabel('C').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`quiz_3_${quizItem.correta}`).setLabel('D').setStyle(ButtonStyle.Primary)
      );

      return message.channel.send({ embeds: [embed], components: [row] });

    } catch (err) {
      console.error('Erro ao gerar quiz por IA:', err);
      return message.reply('Ops! Tive um problema ao gerar a pergunta do quiz. Tente mandar `!atena quiz` novamente!');
    }
  }

  // 2. VER RANKING SEMANAL DE MEMBROS: !atena ranking quiz
  if (textoLimpo === 'ranking quiz' || textoLimpo === 'placar quiz') {
    const quizData = carregarQuizMembros();
    const ordenados = Object.entries(quizData).sort((a, b) => b[1].pontos - a[1].pontos);

    if (ordenados.length === 0) {
      return message.reply('Ninguém pontuou no Quiz ainda esta semana! Mande `!atena quiz` para começar.');
    }

    const medalias = ['🥇', '🥈', '🥉'];
    const lista = ordenados.map(([id, user], i) => {
      const icone = medalias[i] || '👤';
      return `${icone} **${user.nome}**: ${user.pontos} pts`;
    }).slice(0, 10).join('\n');

    const embed = new EmbedBuilder()
      .setColor(0x2ECC71)
      .setTitle('🏆 RANKING SEMANAL DO QUIZ - ATENA')
      .setDescription(lista)
      .setFooter({ text: 'Acumule pontos respondendo perguntas com !atena quiz' });

    return message.channel.send({ embeds: [embed] });
  }

  // 3. ZERAR RANKING DO QUIZ NO FINAL DA SEMANA: !atena premiar quiz
  if (textoLimpo === 'premiar quiz' || textoLimpo === 'zerar quiz') {
    const quizData = carregarQuizMembros();
    const ordenados = Object.entries(quizData).sort((a, b) => b[1].pontos - a[1].pontos);

    if (ordenados.length === 0) return message.reply('O ranking do Quiz já está vazio.');

    const vencedor = ordenados[0][1].nome;
    const pontosVencedor = ordenados[0][1].pontos;

    salvarQuizMembros({}); // Reseta o placar da semana

    return message.reply(`🎉 **FIM DA SEMANA!** 🎉\n\n🏆 O grande campeão da semana foi **${vencedor}** com **${pontosVencedor} pontos**!\n\nO ranking do Quiz foi resetado para a próxima rodada.`);
  }

  // --- RANKING DOS GTS ---
  if (textoLimpo === 'ranking' || textoLimpo === 'placar') {
    const placar = carregarPlacarGTs();
    const listaOrdenada = Object.values(placar).sort((a, b) => b.pontos - a.pontos);
    const medaIas = ['🥇', '🥈', '🥉', '4️⃣'];

    const descricao = listaOrdenada.map((gt, index) => `${medaIas[index]} **${gt.nome}**: ${gt.pontos} pontos`).join('\n\n');

    const embed = new EmbedBuilder()
      .setColor(0xF1C40F)
      .setTitle('🏆 CLASSIFICAÇÃO DOS GTs - KAHOOT')
      .setDescription(descricao)
      .setFooter({ text: 'Crea-GO Jovem • Competição de GTs' });

    return message.channel.send({ embeds: [embed] });
  }

  if (textoLimpo.startsWith('pontuar')) {
    const partes = pergunta.split(' ');
    const chaveGT = partes[1]?.toLowerCase();
    const pontosAdicionar = parseInt(partes[2], 10);

    const aliases = {
      'academicos': 'academicos', 'rh': 'rh', 'marketing': 'marketing',
      'comunicacao': 'marketing', 'superintendencia': 'superintendencia'
    };

    const gtKey = aliases[chaveGT];
    if (!gtKey || isNaN(pontosAdicionar)) {
      return message.reply('⚠️ Use: `!atena pontuar <GT> <pontos>` (Ex: `!atena pontuar rh 1200`)');
    }

    const placar = carregarPlacarGTs();
    placar[gtKey].pontos += pontosAdicionar;
    salvarPlacarGTs(placar);
    return message.reply(`✅ **+${pontosAdicionar} pontos** para o **${placar[gtKey].nome}**! Total: **${placar[gtKey].pontos} pts**.`);
  }

  // --- CHAMADA IA CONVERSACIONAL DO GROQ ---
  try {
    await message.channel.sendTyping();

    const systemInstruction = 
      "Seu nome é Atena, uma Inteligência Artificial desenvolvida pelo Crea-GO Jovem. " +
      "Seu foco principal é auxiliar estudantes, recém-formados e jovens profissionais das áreas de Engenharia, Agronomia e Geociências em Goiás e no Brasil. " +
      "Responda de forma clara, didática, profissional e acolhedora. " +
      "Responda sempre em português do Brasil.";

    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: pergunta },
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.7,
    });

    const respostaTexto = completion.choices[0]?.message?.content || 'Não consegui gerar uma resposta no momento.';

    if (respostaTexto.length > 2000) {
      const partes = respostaTexto.match(/[\s\S]{1,1900}/g) || [];
      for (const parte of partes) await message.reply(parte);
    } else {
      await message.reply(respostaTexto);
    }

  } catch (error) {
    console.error('⚠️ Erro na resposta:', error);
    message.reply('Ops! Tive um problema ao processar sua dúvida.');
  }
});

// --- LISTENER DOS BOTÕES DO QUIZ ---
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;

  if (interaction.customId.startsWith('quiz_')) {
    const [, opcaoEscolhida, opcaoCorreta] = interaction.customId.split('_');
    const usuarioId = interaction.user.id;
    const usuarioNome = interaction.user.username;

    if (opcaoEscolhida === opcaoCorreta) {
      const quizData = carregarQuizMembros();

      if (!quizData[usuarioId]) {
        quizData[usuarioId] = { nome: usuarioNome, pontos: 0 };
      }

      quizData[usuarioId].pontos += 10;
      salvarQuizMembros(quizData);

      await interaction.reply({ 
        content: `🎉 Parabéns, **${usuarioNome}**! Você acertou e ganhou **+10 pontos**! Total acumulado: **${quizData[usuarioId].pontos} pts**.`, 
        ephemeral: true 
      });
    } else {
      await interaction.reply({ 
        content: `❌ Ops! Resposta incorreta. Digite \`!atena quiz\` para tentar outra pergunta!`, 
        ephemeral: true 
      });
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('Atena está online e funcionando!');
});

app.listen(PORT, () => {
    console.log(`Servidor HTTP do Render rodando na porta ${PORT}`);
});