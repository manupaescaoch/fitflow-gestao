export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      agente_config: {
        Row: {
          ativo: boolean
          atualizado_em: string
          atualizado_por: string | null
          canais: string[]
          dias_semana: number[]
          grupo_interno_nome: string | null
          grupo_interno_ultimo_envio_em: string | null
          grupo_interno_zapi_id: string | null
          hora_fim: number
          hora_inicio: number
          id: boolean
          modo_envio: string
          modo_resposta: string
          nome: string
          prompt_principal: string
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          atualizado_por?: string | null
          canais?: string[]
          dias_semana?: number[]
          grupo_interno_nome?: string | null
          grupo_interno_ultimo_envio_em?: string | null
          grupo_interno_zapi_id?: string | null
          hora_fim?: number
          hora_inicio?: number
          id?: boolean
          modo_envio?: string
          modo_resposta?: string
          nome?: string
          prompt_principal?: string
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          atualizado_por?: string | null
          canais?: string[]
          dias_semana?: number[]
          grupo_interno_nome?: string | null
          grupo_interno_ultimo_envio_em?: string | null
          grupo_interno_zapi_id?: string | null
          hora_fim?: number
          hora_inicio?: number
          id?: boolean
          modo_envio?: string
          modo_resposta?: string
          nome?: string
          prompt_principal?: string
        }
        Relationships: []
      }
      agente_logs: {
        Row: {
          aluno_id: string | null
          canal: string | null
          criado_em: string
          data_referencia: string
          id: string
          metadata: Json
          motivo: string | null
          pergunta: string | null
          resposta: string | null
          tipo: string
        }
        Insert: {
          aluno_id?: string | null
          canal?: string | null
          criado_em?: string
          data_referencia?: string
          id?: string
          metadata?: Json
          motivo?: string | null
          pergunta?: string | null
          resposta?: string | null
          tipo: string
        }
        Update: {
          aluno_id?: string | null
          canal?: string | null
          criado_em?: string
          data_referencia?: string
          id?: string
          metadata?: Json
          motivo?: string | null
          pergunta?: string | null
          resposta?: string | null
          tipo?: string
        }
        Relationships: []
      }
      agente_respostas: {
        Row: {
          ativo: boolean
          atualizado_em: string
          atualizado_por: string | null
          categoria: string
          criado_em: string
          id: string
          nome: string
          ordem: number
          publico_alvo: string
          quando_usar: string
          texto: string
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          atualizado_por?: string | null
          categoria: string
          criado_em?: string
          id?: string
          nome: string
          ordem?: number
          publico_alvo?: string
          quando_usar?: string
          texto?: string
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          atualizado_por?: string | null
          categoria?: string
          criado_em?: string
          id?: string
          nome?: string
          ordem?: number
          publico_alvo?: string
          quando_usar?: string
          texto?: string
        }
        Relationships: []
      }
      alimento_favoritos: {
        Row: {
          criado_em: string
          id: string
          nome: string
          principal: Json
          substitutos: Json
          user_id: string
        }
        Insert: {
          criado_em?: string
          id?: string
          nome: string
          principal: Json
          substitutos?: Json
          user_id: string
        }
        Update: {
          criado_em?: string
          id?: string
          nome?: string
          principal?: Json
          substitutos?: Json
          user_id?: string
        }
        Relationships: []
      }
      alimentos: {
        Row: {
          aliases: string[]
          ativo: boolean
          categoria: string | null
          cho_100: number
          criado_em: string
          criado_por: string | null
          fibra_100: number
          fonte: string | null
          id: string
          kcal_100: number
          lip_100: number
          marca: string | null
          nome: string
          ptn_100: number
          qtd_padrao: number
          regiao: string | null
          restricoes: string[]
          subcategoria: string | null
          tags: string[]
          unidade_padrao: string
        }
        Insert: {
          aliases?: string[]
          ativo?: boolean
          categoria?: string | null
          cho_100?: number
          criado_em?: string
          criado_por?: string | null
          fibra_100?: number
          fonte?: string | null
          id?: string
          kcal_100?: number
          lip_100?: number
          marca?: string | null
          nome: string
          ptn_100?: number
          qtd_padrao?: number
          regiao?: string | null
          restricoes?: string[]
          subcategoria?: string | null
          tags?: string[]
          unidade_padrao?: string
        }
        Update: {
          aliases?: string[]
          ativo?: boolean
          categoria?: string | null
          cho_100?: number
          criado_em?: string
          criado_por?: string | null
          fibra_100?: number
          fonte?: string | null
          id?: string
          kcal_100?: number
          lip_100?: number
          marca?: string | null
          nome?: string
          ptn_100?: number
          qtd_padrao?: number
          regiao?: string | null
          restricoes?: string[]
          subcategoria?: string | null
          tags?: string[]
          unidade_padrao?: string
        }
        Relationships: []
      }
      aluno_agua_log: {
        Row: {
          aluno_id: string
          criado_em: string
          data_referencia: string
          id: string
          ml: number
        }
        Insert: {
          aluno_id: string
          criado_em?: string
          data_referencia?: string
          id?: string
          ml: number
        }
        Update: {
          aluno_id?: string
          criado_em?: string
          data_referencia?: string
          id?: string
          ml?: number
        }
        Relationships: []
      }
      aluno_atividades_dia: {
        Row: {
          aluno_id: string
          atualizado_em: string
          concluido: boolean
          criado_em: string
          data_referencia: string
          duracao_min: number | null
          id: string
          tipo: string
        }
        Insert: {
          aluno_id: string
          atualizado_em?: string
          concluido?: boolean
          criado_em?: string
          data_referencia?: string
          duracao_min?: number | null
          id?: string
          tipo: string
        }
        Update: {
          aluno_id?: string
          atualizado_em?: string
          concluido?: boolean
          criado_em?: string
          data_referencia?: string
          duracao_min?: number | null
          id?: string
          tipo?: string
        }
        Relationships: []
      }
      aluno_push_subscriptions: {
        Row: {
          aluno_id: string
          atualizado_em: string
          auth: string
          criado_em: string
          endpoint: string
          id: string
          p256dh: string
          user_agent: string | null
        }
        Insert: {
          aluno_id: string
          atualizado_em?: string
          auth: string
          criado_em?: string
          endpoint: string
          id?: string
          p256dh: string
          user_agent?: string | null
        }
        Update: {
          aluno_id?: string
          atualizado_em?: string
          auth?: string
          criado_em?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aluno_push_subscriptions_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
        ]
      }
      aluno_refeicoes_log: {
        Row: {
          aluno_id: string
          data_referencia: string
          feito_em: string
          id: string
          refeicao_id: string | null
          refeicao_nome: string | null
        }
        Insert: {
          aluno_id: string
          data_referencia?: string
          feito_em?: string
          id?: string
          refeicao_id?: string | null
          refeicao_nome?: string | null
        }
        Update: {
          aluno_id?: string
          data_referencia?: string
          feito_em?: string
          id?: string
          refeicao_id?: string | null
          refeicao_nome?: string | null
        }
        Relationships: []
      }
      alunos: {
        Row: {
          altura_cm: number | null
          atualizado_em: string
          cpf: string | null
          criado_em: string
          data_anamnese: string | null
          data_compra: string | null
          data_d0: string | null
          data_expiracao: string | null
          data_nascimento: string | null
          email: string | null
          foto_url: string | null
          id: string
          modalidade: Database["public"]["Enums"]["aluno_modalidade"] | null
          nome: string
          observacoes: string | null
          origem: string
          peso_kg: number | null
          plano: string | null
          prazo_dias: number
          renovado: boolean
          servico_contratado:
            | Database["public"]["Enums"]["aluno_servico"]
            | null
          sexo: string | null
          status: Database["public"]["Enums"]["aluno_status"]
          total_renovacoes: number
          username: string | null
          valor_plano: number | null
          whatsapp: string
        }
        Insert: {
          altura_cm?: number | null
          atualizado_em?: string
          cpf?: string | null
          criado_em?: string
          data_anamnese?: string | null
          data_compra?: string | null
          data_d0?: string | null
          data_expiracao?: string | null
          data_nascimento?: string | null
          email?: string | null
          foto_url?: string | null
          id?: string
          modalidade?: Database["public"]["Enums"]["aluno_modalidade"] | null
          nome: string
          observacoes?: string | null
          origem?: string
          peso_kg?: number | null
          plano?: string | null
          prazo_dias?: number
          renovado?: boolean
          servico_contratado?:
            | Database["public"]["Enums"]["aluno_servico"]
            | null
          sexo?: string | null
          status?: Database["public"]["Enums"]["aluno_status"]
          total_renovacoes?: number
          username?: string | null
          valor_plano?: number | null
          whatsapp: string
        }
        Update: {
          altura_cm?: number | null
          atualizado_em?: string
          cpf?: string | null
          criado_em?: string
          data_anamnese?: string | null
          data_compra?: string | null
          data_d0?: string | null
          data_expiracao?: string | null
          data_nascimento?: string | null
          email?: string | null
          foto_url?: string | null
          id?: string
          modalidade?: Database["public"]["Enums"]["aluno_modalidade"] | null
          nome?: string
          observacoes?: string | null
          origem?: string
          peso_kg?: number | null
          plano?: string | null
          prazo_dias?: number
          renovado?: boolean
          servico_contratado?:
            | Database["public"]["Enums"]["aluno_servico"]
            | null
          sexo?: string | null
          status?: Database["public"]["Enums"]["aluno_status"]
          total_renovacoes?: number
          username?: string | null
          valor_plano?: number | null
          whatsapp?: string
        }
        Relationships: []
      }
      alunos_acesso: {
        Row: {
          aluno_id: string
          atualizado_em: string
          criado_em: string
          deve_trocar_senha: boolean
          senha_hash: string
          ultimo_login_em: string | null
        }
        Insert: {
          aluno_id: string
          atualizado_em?: string
          criado_em?: string
          deve_trocar_senha?: boolean
          senha_hash: string
          ultimo_login_em?: string | null
        }
        Update: {
          aluno_id?: string
          atualizado_em?: string
          criado_em?: string
          deve_trocar_senha?: boolean
          senha_hash?: string
          ultimo_login_em?: string | null
        }
        Relationships: []
      }
      app_branding: {
        Row: {
          atualizado_em: string
          atualizado_por: string | null
          cor_primaria: string
          id: boolean
          logo_url: string | null
          nome: string
          subtitulo: string
        }
        Insert: {
          atualizado_em?: string
          atualizado_por?: string | null
          cor_primaria?: string
          id?: boolean
          logo_url?: string | null
          nome?: string
          subtitulo?: string
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string | null
          cor_primaria?: string
          id?: boolean
          logo_url?: string | null
          nome?: string
          subtitulo?: string
        }
        Relationships: []
      }
      body_circumferences: {
        Row: {
          abdomen: number | null
          assessment_id: string
          contracted_left_arm: number | null
          contracted_right_arm: number | null
          created_at: string
          hip: number | null
          id: string
          left_calf: number | null
          left_thigh: number | null
          relaxed_left_arm: number | null
          relaxed_right_arm: number | null
          right_calf: number | null
          right_thigh: number | null
          shoulder: number | null
          updated_at: string
          waist: number | null
        }
        Insert: {
          abdomen?: number | null
          assessment_id: string
          contracted_left_arm?: number | null
          contracted_right_arm?: number | null
          created_at?: string
          hip?: number | null
          id?: string
          left_calf?: number | null
          left_thigh?: number | null
          relaxed_left_arm?: number | null
          relaxed_right_arm?: number | null
          right_calf?: number | null
          right_thigh?: number | null
          shoulder?: number | null
          updated_at?: string
          waist?: number | null
        }
        Update: {
          abdomen?: number | null
          assessment_id?: string
          contracted_left_arm?: number | null
          contracted_right_arm?: number | null
          created_at?: string
          hip?: number | null
          id?: string
          left_calf?: number | null
          left_thigh?: number | null
          relaxed_left_arm?: number | null
          relaxed_right_arm?: number | null
          right_calf?: number | null
          right_thigh?: number | null
          shoulder?: number | null
          updated_at?: string
          waist?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "body_circumferences_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: true
            referencedRelation: "physical_assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      community_likes: {
        Row: {
          aluno_id: string
          created_at: string
          post_id: string
        }
        Insert: {
          aluno_id: string
          created_at?: string
          post_id: string
        }
        Update: {
          aluno_id?: string
          created_at?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_likes_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      community_posts: {
        Row: {
          aluno_id: string
          created_at: string
          foto_url: string
          id: string
          legenda: string | null
        }
        Insert: {
          aluno_id: string
          created_at?: string
          foto_url: string
          id?: string
          legenda?: string | null
        }
        Update: {
          aluno_id?: string
          created_at?: string
          foto_url?: string
          id?: string
          legenda?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "community_posts_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
        ]
      }
      comunicacoes: {
        Row: {
          aluno_id: string
          canal: string
          criado_em: string
          enviado_em: string
          gatilho: string
          id: string
          mensagem: string
          status: string
        }
        Insert: {
          aluno_id: string
          canal?: string
          criado_em?: string
          enviado_em?: string
          gatilho: string
          id?: string
          mensagem: string
          status?: string
        }
        Update: {
          aluno_id?: string
          canal?: string
          criado_em?: string
          enviado_em?: string
          gatilho?: string
          id?: string
          mensagem?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "comunicacoes_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_checkins: {
        Row: {
          alimentacao_fim_semana: string | null
          aluno_id: string
          created_at: string
          data_checkin: string
          energia: number | null
          exagero_fim_semana: string | null
          foco_semana: string | null
          humor: number | null
          id: string
          qualidade_sono: number | null
          score_gerado: number
          sono_horas: number | null
          updated_at: string
        }
        Insert: {
          alimentacao_fim_semana?: string | null
          aluno_id: string
          created_at?: string
          data_checkin?: string
          energia?: number | null
          exagero_fim_semana?: string | null
          foco_semana?: string | null
          humor?: number | null
          id?: string
          qualidade_sono?: number | null
          score_gerado?: number
          sono_horas?: number | null
          updated_at?: string
        }
        Update: {
          alimentacao_fim_semana?: string | null
          aluno_id?: string
          created_at?: string
          data_checkin?: string
          energia?: number | null
          exagero_fim_semana?: string | null
          foco_semana?: string | null
          humor?: number | null
          id?: string
          qualidade_sono?: number | null
          score_gerado?: number
          sono_horas?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_checkins_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
        ]
      }
      dieta_item_substitutos: {
        Row: {
          alimento_id: string | null
          cho: number
          criado_em: string
          id: string
          item_id: string
          kcal: number
          lip: number
          nome_custom: string | null
          ordem: number
          ptn: number
          quantidade: number
          unidade: string
        }
        Insert: {
          alimento_id?: string | null
          cho?: number
          criado_em?: string
          id?: string
          item_id: string
          kcal?: number
          lip?: number
          nome_custom?: string | null
          ordem?: number
          ptn?: number
          quantidade?: number
          unidade?: string
        }
        Update: {
          alimento_id?: string | null
          cho?: number
          criado_em?: string
          id?: string
          item_id?: string
          kcal?: number
          lip?: number
          nome_custom?: string | null
          ordem?: number
          ptn?: number
          quantidade?: number
          unidade?: string
        }
        Relationships: [
          {
            foreignKeyName: "dieta_item_substitutos_alimento_id_fkey"
            columns: ["alimento_id"]
            isOneToOne: false
            referencedRelation: "alimentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dieta_item_substitutos_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "dieta_itens"
            referencedColumns: ["id"]
          },
        ]
      }
      dieta_itens: {
        Row: {
          alimento_id: string | null
          cho: number
          criado_em: string
          id: string
          kcal: number
          lip: number
          nome_custom: string | null
          ordem: number
          ptn: number
          quantidade: number
          refeicao_id: string
          unidade: string
        }
        Insert: {
          alimento_id?: string | null
          cho?: number
          criado_em?: string
          id?: string
          kcal?: number
          lip?: number
          nome_custom?: string | null
          ordem?: number
          ptn?: number
          quantidade?: number
          refeicao_id: string
          unidade?: string
        }
        Update: {
          alimento_id?: string | null
          cho?: number
          criado_em?: string
          id?: string
          kcal?: number
          lip?: number
          nome_custom?: string | null
          ordem?: number
          ptn?: number
          quantidade?: number
          refeicao_id?: string
          unidade?: string
        }
        Relationships: [
          {
            foreignKeyName: "dieta_itens_alimento_id_fkey"
            columns: ["alimento_id"]
            isOneToOne: false
            referencedRelation: "alimentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dieta_itens_refeicao_id_fkey"
            columns: ["refeicao_id"]
            isOneToOne: false
            referencedRelation: "dieta_refeicoes"
            referencedColumns: ["id"]
          },
        ]
      }
      dieta_planos: {
        Row: {
          aluno_id: string | null
          atualizado_em: string
          cho_g_kg: number | null
          criado_em: string
          criado_por: string | null
          descricao: string | null
          dias_semana: string[]
          id: string
          lip_g_kg: number | null
          meta_kcal: number | null
          nome: string
          observacoes: string | null
          peso_referencia: number | null
          ptn_g_kg: number | null
          status: string
          template: boolean
        }
        Insert: {
          aluno_id?: string | null
          atualizado_em?: string
          cho_g_kg?: number | null
          criado_em?: string
          criado_por?: string | null
          descricao?: string | null
          dias_semana?: string[]
          id?: string
          lip_g_kg?: number | null
          meta_kcal?: number | null
          nome?: string
          observacoes?: string | null
          peso_referencia?: number | null
          ptn_g_kg?: number | null
          status?: string
          template?: boolean
        }
        Update: {
          aluno_id?: string | null
          atualizado_em?: string
          cho_g_kg?: number | null
          criado_em?: string
          criado_por?: string | null
          descricao?: string | null
          dias_semana?: string[]
          id?: string
          lip_g_kg?: number | null
          meta_kcal?: number | null
          nome?: string
          observacoes?: string | null
          peso_referencia?: number | null
          ptn_g_kg?: number | null
          status?: string
          template?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "dieta_planos_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
        ]
      }
      dieta_refeicoes: {
        Row: {
          criado_em: string
          horario: string | null
          id: string
          nome: string
          observacoes: string | null
          ordem: number
          plano_id: string
        }
        Insert: {
          criado_em?: string
          horario?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          ordem?: number
          plano_id: string
        }
        Update: {
          criado_em?: string
          horario?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          ordem?: number
          plano_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dieta_refeicoes_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "dieta_planos"
            referencedColumns: ["id"]
          },
        ]
      }
      entregas_dia: {
        Row: {
          aluno_id: string
          criado_em: string
          d0_confirmado: boolean
          d0_confirmado_em: string | null
          d0_confirmado_por: string | null
          data_referencia: string
          dieta_entregue: boolean
          dieta_entregue_em: string | null
          dieta_entregue_por: string | null
          id: string
          treino_entregue: boolean
          treino_entregue_em: string | null
          treino_entregue_por: string | null
        }
        Insert: {
          aluno_id: string
          criado_em?: string
          d0_confirmado?: boolean
          d0_confirmado_em?: string | null
          d0_confirmado_por?: string | null
          data_referencia: string
          dieta_entregue?: boolean
          dieta_entregue_em?: string | null
          dieta_entregue_por?: string | null
          id?: string
          treino_entregue?: boolean
          treino_entregue_em?: string | null
          treino_entregue_por?: string | null
        }
        Update: {
          aluno_id?: string
          criado_em?: string
          d0_confirmado?: boolean
          d0_confirmado_em?: string | null
          d0_confirmado_por?: string | null
          data_referencia?: string
          dieta_entregue?: boolean
          dieta_entregue_em?: string | null
          dieta_entregue_por?: string | null
          id?: string
          treino_entregue?: boolean
          treino_entregue_em?: string | null
          treino_entregue_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "entregas_dia_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
        ]
      }
      entregas_dia_log: {
        Row: {
          aluno_id: string | null
          aluno_nome: string | null
          criado_em: string
          data_base: string | null
          data_referencia: string | null
          detalhes: Json
          id: string
          origem: string
          resultado: string
          tipo_evento: string
        }
        Insert: {
          aluno_id?: string | null
          aluno_nome?: string | null
          criado_em?: string
          data_base?: string | null
          data_referencia?: string | null
          detalhes?: Json
          id?: string
          origem: string
          resultado: string
          tipo_evento: string
        }
        Update: {
          aluno_id?: string | null
          aluno_nome?: string | null
          criado_em?: string
          data_base?: string | null
          data_referencia?: string | null
          detalhes?: Json
          id?: string
          origem?: string
          resultado?: string
          tipo_evento?: string
        }
        Relationships: []
      }
      feedback_agendamentos: {
        Row: {
          aluno_id: string
          ativo: boolean
          atualizado_em: string
          criado_em: string
          id: string
          intervalo_dias: number
          periodicidade: string
          proximo_envio_em: string | null
          template_id: string
          ultimo_envio_em: string | null
        }
        Insert: {
          aluno_id: string
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          id?: string
          intervalo_dias: number
          periodicidade: string
          proximo_envio_em?: string | null
          template_id: string
          ultimo_envio_em?: string | null
        }
        Update: {
          aluno_id?: string
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          id?: string
          intervalo_dias?: number
          periodicidade?: string
          proximo_envio_em?: string | null
          template_id?: string
          ultimo_envio_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feedback_agendamentos_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_agendamentos_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "feedback_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback_envios: {
        Row: {
          aluno_id: string
          enviado_em: string
          expira_em: string | null
          id: string
          respondido_em: string | null
          respostas: Json | null
          status: string
          template_id: string
          token: string
        }
        Insert: {
          aluno_id: string
          enviado_em?: string
          expira_em?: string | null
          id?: string
          respondido_em?: string | null
          respostas?: Json | null
          status?: string
          template_id: string
          token?: string
        }
        Update: {
          aluno_id?: string
          enviado_em?: string
          expira_em?: string | null
          id?: string
          respondido_em?: string | null
          respostas?: Json | null
          status?: string
          template_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_envios_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_envios_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "feedback_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback_templates: {
        Row: {
          ativo: boolean
          atualizado_em: string
          criado_em: string
          descricao: string | null
          id: string
          nome: string
          perguntas: Json
          tipo: string
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          descricao?: string | null
          id?: string
          nome: string
          perguntas?: Json
          tipo?: string
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          descricao?: string | null
          id?: string
          nome?: string
          perguntas?: Json
          tipo?: string
        }
        Relationships: []
      }
      financeiro_categorias: {
        Row: {
          cor: string
          criado_em: string
          id: string
          nome: string
          tipo: string
        }
        Insert: {
          cor?: string
          criado_em?: string
          id?: string
          nome: string
          tipo: string
        }
        Update: {
          cor?: string
          criado_em?: string
          id?: string
          nome?: string
          tipo?: string
        }
        Relationships: []
      }
      financeiro_config: {
        Row: {
          atualizado_em: string
          dias_alerta_vencimento: number
          id: string
          juros_pct: number
          mensagem_cobranca: string
          multa_pct: number
        }
        Insert: {
          atualizado_em?: string
          dias_alerta_vencimento?: number
          id?: string
          juros_pct?: number
          mensagem_cobranca?: string
          multa_pct?: number
        }
        Update: {
          atualizado_em?: string
          dias_alerta_vencimento?: number
          id?: string
          juros_pct?: number
          mensagem_cobranca?: string
          multa_pct?: number
        }
        Relationships: []
      }
      food_measures: {
        Row: {
          created_at: string
          display_dropdown: string | null
          display_prescription: string | null
          food_id: string
          grams_equivalent: number
          id: string
          is_default: boolean
          measure_name: string
          measure_type: string | null
          observation: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_dropdown?: string | null
          display_prescription?: string | null
          food_id: string
          grams_equivalent?: number
          id?: string
          is_default?: boolean
          measure_name: string
          measure_type?: string | null
          observation?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_dropdown?: string | null
          display_prescription?: string | null
          food_id?: string
          grams_equivalent?: number
          id?: string
          is_default?: boolean
          measure_name?: string
          measure_type?: string | null
          observation?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_measures_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "foods"
            referencedColumns: ["id"]
          },
        ]
      }
      foods: {
        Row: {
          carbs_100g: number
          category: string | null
          created_at: string
          created_by_user: boolean
          fat_100g: number
          fiber_100g: number
          id: string
          is_fruit: boolean
          kcal_100g: number
          name: string
          name_normalized: string | null
          original_subcategory: string | null
          protein_100g: number
          source: string | null
          source_document: string | null
          updated_at: string
        }
        Insert: {
          carbs_100g?: number
          category?: string | null
          created_at?: string
          created_by_user?: boolean
          fat_100g?: number
          fiber_100g?: number
          id?: string
          is_fruit?: boolean
          kcal_100g?: number
          name: string
          name_normalized?: string | null
          original_subcategory?: string | null
          protein_100g?: number
          source?: string | null
          source_document?: string | null
          updated_at?: string
        }
        Update: {
          carbs_100g?: number
          category?: string | null
          created_at?: string
          created_by_user?: boolean
          fat_100g?: number
          fiber_100g?: number
          id?: string
          is_fruit?: boolean
          kcal_100g?: number
          name?: string
          name_normalized?: string | null
          original_subcategory?: string | null
          protein_100g?: number
          source?: string | null
          source_document?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      form_formularios: {
        Row: {
          abre_em: string | null
          atualizado_em: string
          autor_id: string | null
          autor_nome: string | null
          capa_url: string | null
          config: Json
          cor_primaria: string
          criado_em: string
          descricao: string | null
          encerra_em: string | null
          excluido_em: string | null
          id: string
          max_respostas: number | null
          mensagem_sucesso: string
          publicado_em: string | null
          redirect_url: string | null
          responsavel_id: string | null
          slug: string
          status: string
          titulo: string
          total_respostas: number
          ultima_resposta_em: string | null
          versao: number
        }
        Insert: {
          abre_em?: string | null
          atualizado_em?: string
          autor_id?: string | null
          autor_nome?: string | null
          capa_url?: string | null
          config?: Json
          cor_primaria?: string
          criado_em?: string
          descricao?: string | null
          encerra_em?: string | null
          excluido_em?: string | null
          id?: string
          max_respostas?: number | null
          mensagem_sucesso?: string
          publicado_em?: string | null
          redirect_url?: string | null
          responsavel_id?: string | null
          slug?: string
          status?: string
          titulo?: string
          total_respostas?: number
          ultima_resposta_em?: string | null
          versao?: number
        }
        Update: {
          abre_em?: string | null
          atualizado_em?: string
          autor_id?: string | null
          autor_nome?: string | null
          capa_url?: string | null
          config?: Json
          cor_primaria?: string
          criado_em?: string
          descricao?: string | null
          encerra_em?: string | null
          excluido_em?: string | null
          id?: string
          max_respostas?: number | null
          mensagem_sucesso?: string
          publicado_em?: string | null
          redirect_url?: string | null
          responsavel_id?: string | null
          slug?: string
          status?: string
          titulo?: string
          total_respostas?: number
          ultima_resposta_em?: string | null
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "form_formularios_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "usuarios_crm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_formularios_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "usuarios_crm"
            referencedColumns: ["id"]
          },
        ]
      }
      form_perguntas: {
        Row: {
          atualizado_em: string
          condicoes: Json
          config: Json
          criado_em: string
          descricao: string | null
          excluido_em: string | null
          formulario_id: string
          id: string
          obrigatoria: boolean
          opcoes: Json
          ordem: number
          secao_id: string | null
          tipo: string
          titulo: string
        }
        Insert: {
          atualizado_em?: string
          condicoes?: Json
          config?: Json
          criado_em?: string
          descricao?: string | null
          excluido_em?: string | null
          formulario_id: string
          id?: string
          obrigatoria?: boolean
          opcoes?: Json
          ordem?: number
          secao_id?: string | null
          tipo?: string
          titulo?: string
        }
        Update: {
          atualizado_em?: string
          condicoes?: Json
          config?: Json
          criado_em?: string
          descricao?: string | null
          excluido_em?: string | null
          formulario_id?: string
          id?: string
          obrigatoria?: boolean
          opcoes?: Json
          ordem?: number
          secao_id?: string | null
          tipo?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_perguntas_formulario_id_fkey"
            columns: ["formulario_id"]
            isOneToOne: false
            referencedRelation: "form_formularios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_perguntas_secao_id_fkey"
            columns: ["secao_id"]
            isOneToOne: false
            referencedRelation: "form_secoes"
            referencedColumns: ["id"]
          },
        ]
      }
      form_resposta_comentarios: {
        Row: {
          autor_id: string | null
          autor_nome: string | null
          criado_em: string
          id: string
          interno: boolean
          resposta_id: string
          texto: string
        }
        Insert: {
          autor_id?: string | null
          autor_nome?: string | null
          criado_em?: string
          id?: string
          interno?: boolean
          resposta_id: string
          texto: string
        }
        Update: {
          autor_id?: string | null
          autor_nome?: string | null
          criado_em?: string
          id?: string
          interno?: boolean
          resposta_id?: string
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_resposta_comentarios_resposta_id_fkey"
            columns: ["resposta_id"]
            isOneToOne: false
            referencedRelation: "form_respostas"
            referencedColumns: ["id"]
          },
        ]
      }
      form_resposta_eventos: {
        Row: {
          autor_id: string | null
          autor_nome: string | null
          campo: string
          criado_em: string
          de: string | null
          id: string
          para: string | null
          resposta_id: string
        }
        Insert: {
          autor_id?: string | null
          autor_nome?: string | null
          campo: string
          criado_em?: string
          de?: string | null
          id?: string
          para?: string | null
          resposta_id: string
        }
        Update: {
          autor_id?: string | null
          autor_nome?: string | null
          campo?: string
          criado_em?: string
          de?: string | null
          id?: string
          para?: string | null
          resposta_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_resposta_eventos_resposta_id_fkey"
            columns: ["resposta_id"]
            isOneToOne: false
            referencedRelation: "form_respostas"
            referencedColumns: ["id"]
          },
        ]
      }
      form_resposta_itens: {
        Row: {
          arquivos: Json
          criado_em: string
          id: string
          ordem: number
          pergunta_id: string | null
          pergunta_tipo: string
          pergunta_titulo: string
          resposta_id: string
          valor_data: string | null
          valor_json: Json | null
          valor_num: number | null
          valor_texto: string | null
        }
        Insert: {
          arquivos?: Json
          criado_em?: string
          id?: string
          ordem?: number
          pergunta_id?: string | null
          pergunta_tipo: string
          pergunta_titulo: string
          resposta_id: string
          valor_data?: string | null
          valor_json?: Json | null
          valor_num?: number | null
          valor_texto?: string | null
        }
        Update: {
          arquivos?: Json
          criado_em?: string
          id?: string
          ordem?: number
          pergunta_id?: string | null
          pergunta_tipo?: string
          pergunta_titulo?: string
          resposta_id?: string
          valor_data?: string | null
          valor_json?: Json | null
          valor_num?: number | null
          valor_texto?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "form_resposta_itens_pergunta_id_fkey"
            columns: ["pergunta_id"]
            isOneToOne: false
            referencedRelation: "form_perguntas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_resposta_itens_resposta_id_fkey"
            columns: ["resposta_id"]
            isOneToOne: false
            referencedRelation: "form_respostas"
            referencedColumns: ["id"]
          },
        ]
      }
      form_respostas: {
        Row: {
          aluno_id: string | null
          atualizado_em: string
          critica: boolean
          duracao_seg: number | null
          edit_token: string
          enviado_em: string
          formulario_id: string
          id: string
          identificador: string | null
          prazo: string | null
          prioridade: string
          protocolo: string
          respondente_email: string | null
          respondente_nome: string | null
          respondente_telefone: string | null
          responsavel_id: string | null
          revisada: boolean
          status: string
        }
        Insert: {
          aluno_id?: string | null
          atualizado_em?: string
          critica?: boolean
          duracao_seg?: number | null
          edit_token?: string
          enviado_em?: string
          formulario_id: string
          id?: string
          identificador?: string | null
          prazo?: string | null
          prioridade?: string
          protocolo?: string
          respondente_email?: string | null
          respondente_nome?: string | null
          respondente_telefone?: string | null
          responsavel_id?: string | null
          revisada?: boolean
          status?: string
        }
        Update: {
          aluno_id?: string | null
          atualizado_em?: string
          critica?: boolean
          duracao_seg?: number | null
          edit_token?: string
          enviado_em?: string
          formulario_id?: string
          id?: string
          identificador?: string | null
          prazo?: string | null
          prioridade?: string
          protocolo?: string
          respondente_email?: string | null
          respondente_nome?: string | null
          respondente_telefone?: string | null
          responsavel_id?: string | null
          revisada?: boolean
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_respostas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_respostas_formulario_id_fkey"
            columns: ["formulario_id"]
            isOneToOne: false
            referencedRelation: "form_formularios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_respostas_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "usuarios_crm"
            referencedColumns: ["id"]
          },
        ]
      }
      form_secoes: {
        Row: {
          atualizado_em: string
          criado_em: string
          descricao: string | null
          destino: string
          destino_secao_id: string | null
          excluido_em: string | null
          formulario_id: string
          id: string
          ordem: number
          titulo: string
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          descricao?: string | null
          destino?: string
          destino_secao_id?: string | null
          excluido_em?: string | null
          formulario_id: string
          id?: string
          ordem?: number
          titulo?: string
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          descricao?: string | null
          destino?: string
          destino_secao_id?: string | null
          excluido_em?: string | null
          formulario_id?: string
          id?: string
          ordem?: number
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_secoes_formulario_id_fkey"
            columns: ["formulario_id"]
            isOneToOne: false
            referencedRelation: "form_formularios"
            referencedColumns: ["id"]
          },
        ]
      }
      formulario_verificacoes: {
        Row: {
          id: string
          aluno_id: string
          tipo: "feedback_mensal" | "feedback_quinzenal"
          codigo_hash: string
          salt: string
          tentativas: number
          expira_em: string
          usado_em: string | null
          criado_em: string
        }
        Insert: {
          id?: string
          aluno_id: string
          tipo: "feedback_mensal" | "feedback_quinzenal"
          codigo_hash: string
          salt: string
          tentativas?: number
          expira_em: string
          usado_em?: string | null
          criado_em?: string
        }
        Update: {
          id?: string
          aluno_id?: string
          tipo?: "feedback_mensal" | "feedback_quinzenal"
          codigo_hash?: string
          salt?: string
          tentativas?: number
          expira_em?: string
          usado_em?: string | null
          criado_em?: string
        }
        Relationships: []
      }
      formularios: {
        Row: {
          aluno_id: string | null
          confirmado_em: string | null
          confirmado_equipe: boolean
          confirmado_por: string | null
          criado_em: string
          dados_resposta: Json | null
          id: string
          link_publico: string | null
          origem: string
          recebido_em: string
          respondido: boolean
          respondido_em: string | null
          tipo: Database["public"]["Enums"]["formulario_tipo"]
          token: string
        }
        Insert: {
          aluno_id?: string | null
          confirmado_em?: string | null
          confirmado_equipe?: boolean
          confirmado_por?: string | null
          criado_em?: string
          dados_resposta?: Json | null
          id?: string
          link_publico?: string | null
          origem?: string
          recebido_em?: string
          respondido?: boolean
          respondido_em?: string | null
          tipo: Database["public"]["Enums"]["formulario_tipo"]
          token?: string
        }
        Update: {
          aluno_id?: string | null
          confirmado_em?: string | null
          confirmado_equipe?: boolean
          confirmado_por?: string | null
          criado_em?: string
          dados_resposta?: Json | null
          id?: string
          link_publico?: string | null
          origem?: string
          recebido_em?: string
          respondido?: boolean
          respondido_em?: string | null
          tipo?: Database["public"]["Enums"]["formulario_tipo"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "formularios_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
        ]
      }
      fruit_portion_options: {
        Row: {
          active: boolean
          food_name: string
          grams: number
          id: string
          reference_kcal: number
          sort_order: number
        }
        Insert: {
          active?: boolean
          food_name: string
          grams: number
          id?: string
          reference_kcal?: number
          sort_order?: number
        }
        Update: {
          active?: boolean
          food_name?: string
          grams?: number
          id?: string
          reference_kcal?: number
          sort_order?: number
        }
        Relationships: []
      }
      historico_status: {
        Row: {
          alterado_por: string | null
          aluno_id: string | null
          criado_em: string
          id: string
          status_de: string | null
          status_para: string | null
        }
        Insert: {
          alterado_por?: string | null
          aluno_id?: string | null
          criado_em?: string
          id?: string
          status_de?: string | null
          status_para?: string | null
        }
        Update: {
          alterado_por?: string | null
          aluno_id?: string | null
          criado_em?: string
          id?: string
          status_de?: string | null
          status_para?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "historico_status_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs_disparos: {
        Row: {
          agendado_para: string
          aluno_id: string | null
          criado_em: string
          erro: string | null
          executado: boolean
          executado_em: string | null
          formulario_id: string | null
          id: string
          payload: Json | null
          tentativas: number
          tipo: Database["public"]["Enums"]["job_tipo"]
        }
        Insert: {
          agendado_para: string
          aluno_id?: string | null
          criado_em?: string
          erro?: string | null
          executado?: boolean
          executado_em?: string | null
          formulario_id?: string | null
          id?: string
          payload?: Json | null
          tentativas?: number
          tipo: Database["public"]["Enums"]["job_tipo"]
        }
        Update: {
          agendado_para?: string
          aluno_id?: string | null
          criado_em?: string
          erro?: string | null
          executado?: boolean
          executado_em?: string | null
          formulario_id?: string | null
          id?: string
          payload?: Json | null
          tentativas?: number
          tipo?: Database["public"]["Enums"]["job_tipo"]
        }
        Relationships: [
          {
            foreignKeyName: "jobs_disparos_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
        ]
      }
      mensagens_dieta: {
        Row: {
          ajustes_realizados: string
          aluno_id: string | null
          criado_em: string
          criado_por: string | null
          dificuldades: string | null
          enviado_whatsapp_em: string | null
          id: string
          medidas_otimizacao: string
          mensagem_gerada: string | null
        }
        Insert: {
          ajustes_realizados: string
          aluno_id?: string | null
          criado_em?: string
          criado_por?: string | null
          dificuldades?: string | null
          enviado_whatsapp_em?: string | null
          id?: string
          medidas_otimizacao: string
          mensagem_gerada?: string | null
        }
        Update: {
          ajustes_realizados?: string
          aluno_id?: string | null
          criado_em?: string
          criado_por?: string | null
          dificuldades?: string | null
          enviado_whatsapp_em?: string | null
          id?: string
          medidas_otimizacao?: string
          mensagem_gerada?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mensagens_dieta_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
        ]
      }
      mensagens_log: {
        Row: {
          aluno_id: string | null
          enviado_em: string
          erro_detalhe: string | null
          id: string
          mensagem_enviada: string | null
          status_envio: Database["public"]["Enums"]["envio_status"] | null
          tipo_job: string | null
          whatsapp_destino: string | null
        }
        Insert: {
          aluno_id?: string | null
          enviado_em?: string
          erro_detalhe?: string | null
          id?: string
          mensagem_enviada?: string | null
          status_envio?: Database["public"]["Enums"]["envio_status"] | null
          tipo_job?: string | null
          whatsapp_destino?: string | null
        }
        Update: {
          aluno_id?: string | null
          enviado_em?: string
          erro_detalhe?: string | null
          id?: string
          mensagem_enviada?: string | null
          status_envio?: Database["public"]["Enums"]["envio_status"] | null
          tipo_job?: string | null
          whatsapp_destino?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mensagens_log_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
        ]
      }
      mensagens_template: {
        Row: {
          ativo: boolean
          atualizado_em: string
          id: string
          modalidade: Database["public"]["Enums"]["template_modalidade"]
          texto: string
          tipo_job: Database["public"]["Enums"]["job_tipo"]
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          id?: string
          modalidade: Database["public"]["Enums"]["template_modalidade"]
          texto: string
          tipo_job: Database["public"]["Enums"]["job_tipo"]
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          id?: string
          modalidade?: Database["public"]["Enums"]["template_modalidade"]
          texto?: string
          tipo_job?: Database["public"]["Enums"]["job_tipo"]
        }
        Relationships: []
      }
      mensagens_treino: {
        Row: {
          ajustes_realizados: string
          aluno_id: string | null
          criado_em: string
          criado_por: string | null
          dificuldades: string | null
          enviado_whatsapp_em: string | null
          id: string
          medidas_otimizacao: string
          mensagem_gerada: string | null
        }
        Insert: {
          ajustes_realizados: string
          aluno_id?: string | null
          criado_em?: string
          criado_por?: string | null
          dificuldades?: string | null
          enviado_whatsapp_em?: string | null
          id?: string
          medidas_otimizacao: string
          mensagem_gerada?: string | null
        }
        Update: {
          ajustes_realizados?: string
          aluno_id?: string | null
          criado_em?: string
          criado_por?: string | null
          dificuldades?: string | null
          enviado_whatsapp_em?: string | null
          id?: string
          medidas_otimizacao?: string
          mensagem_gerada?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mensagens_treino_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
        ]
      }
      mensagens_variantes: {
        Row: {
          ativo: boolean
          atualizado_em: string
          atualizado_por: string | null
          chave: string
          criado_em: string
          id: string
          ordem: number
          texto: string
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          atualizado_por?: string | null
          chave: string
          criado_em?: string
          id?: string
          ordem?: number
          texto: string
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          atualizado_por?: string | null
          chave?: string
          criado_em?: string
          id?: string
          ordem?: number
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "mensagens_variantes_atualizado_por_fkey"
            columns: ["atualizado_por"]
            isOneToOne: false
            referencedRelation: "usuarios_crm"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacoes: {
        Row: {
          criado_em: string
          id: string
          lida: boolean
          link: string | null
          mensagem: string | null
          tipo: string
          titulo: string
          usuario_id: string
        }
        Insert: {
          criado_em?: string
          id?: string
          lida?: boolean
          link?: string | null
          mensagem?: string | null
          tipo?: string
          titulo: string
          usuario_id: string
        }
        Update: {
          criado_em?: string
          id?: string
          lida?: boolean
          link?: string | null
          mensagem?: string | null
          tipo?: string
          titulo?: string
          usuario_id?: string
        }
        Relationships: []
      }
      pendencias_comunicacao_acoes: {
        Row: {
          acao: string
          aluno_id: string
          atualizado_em: string
          criado_em: string
          data_prevista: string | null
          id: string
          job_id: string | null
          observacao: string | null
          tipo_mensagem: string
          usuario_id: string | null
          usuario_nome: string | null
        }
        Insert: {
          acao?: string
          aluno_id: string
          atualizado_em?: string
          criado_em?: string
          data_prevista?: string | null
          id?: string
          job_id?: string | null
          observacao?: string | null
          tipo_mensagem: string
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Update: {
          acao?: string
          aluno_id?: string
          atualizado_em?: string
          criado_em?: string
          data_prevista?: string | null
          id?: string
          job_id?: string | null
          observacao?: string | null
          tipo_mensagem?: string
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pendencias_comunicacao_acoes_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
        ]
      }
      permissoes_modulos: {
        Row: {
          ativo: boolean
          criado_em: string
          id: string
          modulo: string
          perfil: string
        }
        Insert: {
          ativo?: boolean
          criado_em?: string
          id?: string
          modulo: string
          perfil: string
        }
        Update: {
          ativo?: boolean
          criado_em?: string
          id?: string
          modulo?: string
          perfil?: string
        }
        Relationships: []
      }
      photo_audit_logs: {
        Row: {
          aluno_id: string | null
          aluno_nome: string | null
          created_at: string
          error_reason: string | null
          formulario_id: string | null
          id: string
          last_sign_attempt_at: string | null
          needs_resign: boolean
          notes: string | null
          original_url: string | null
          photo_type: string | null
          resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
          sign_attempts: number
          signed_url: string | null
          source: string | null
          updated_at: string
          url_status: string
        }
        Insert: {
          aluno_id?: string | null
          aluno_nome?: string | null
          created_at?: string
          error_reason?: string | null
          formulario_id?: string | null
          id?: string
          last_sign_attempt_at?: string | null
          needs_resign?: boolean
          notes?: string | null
          original_url?: string | null
          photo_type?: string | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          sign_attempts?: number
          signed_url?: string | null
          source?: string | null
          updated_at?: string
          url_status?: string
        }
        Update: {
          aluno_id?: string | null
          aluno_nome?: string | null
          created_at?: string
          error_reason?: string | null
          formulario_id?: string | null
          id?: string
          last_sign_attempt_at?: string | null
          needs_resign?: boolean
          notes?: string | null
          original_url?: string | null
          photo_type?: string | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          sign_attempts?: number
          signed_url?: string | null
          source?: string | null
          updated_at?: string
          url_status?: string
        }
        Relationships: []
      }
      physical_assessments: {
        Row: {
          arm_fat_area: number | null
          arm_muscle_area: number | null
          assessment_date: string
          assessment_type: string
          bmi: number | null
          body_fat_percentage: number | null
          created_at: string
          evaluator_id: string | null
          evaluator_name: string | null
          fat_mass_kg: number | null
          height: number | null
          id: string
          lean_mass_kg: number | null
          lean_mass_percentage: number | null
          notes: string | null
          protocolo_dobras: string | null
          skinfold_sum: number | null
          student_id: string
          updated_at: string
          waist_hip_ratio: number | null
          weight: number | null
        }
        Insert: {
          arm_fat_area?: number | null
          arm_muscle_area?: number | null
          assessment_date?: string
          assessment_type?: string
          bmi?: number | null
          body_fat_percentage?: number | null
          created_at?: string
          evaluator_id?: string | null
          evaluator_name?: string | null
          fat_mass_kg?: number | null
          height?: number | null
          id?: string
          lean_mass_kg?: number | null
          lean_mass_percentage?: number | null
          notes?: string | null
          protocolo_dobras?: string | null
          skinfold_sum?: number | null
          student_id: string
          updated_at?: string
          waist_hip_ratio?: number | null
          weight?: number | null
        }
        Update: {
          arm_fat_area?: number | null
          arm_muscle_area?: number | null
          assessment_date?: string
          assessment_type?: string
          bmi?: number | null
          body_fat_percentage?: number | null
          created_at?: string
          evaluator_id?: string | null
          evaluator_name?: string | null
          fat_mass_kg?: number | null
          height?: number | null
          id?: string
          lean_mass_kg?: number | null
          lean_mass_percentage?: number | null
          notes?: string | null
          protocolo_dobras?: string | null
          skinfold_sum?: number | null
          student_id?: string
          updated_at?: string
          waist_hip_ratio?: number | null
          weight?: number | null
        }
        Relationships: []
      }
      planos_catalogo: {
        Row: {
          ativo: boolean
          atualizado_em: string
          criado_em: string
          descricao: string | null
          duracao_dias: number
          id: string
          modalidade: Database["public"]["Enums"]["aluno_modalidade"]
          nome: string
          valor_padrao: number
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          descricao?: string | null
          duracao_dias?: number
          id?: string
          modalidade: Database["public"]["Enums"]["aluno_modalidade"]
          nome: string
          valor_padrao?: number
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          descricao?: string | null
          duracao_dias?: number
          id?: string
          modalidade?: Database["public"]["Enums"]["aluno_modalidade"]
          nome?: string
          valor_padrao?: number
        }
        Relationships: []
      }
      pontos_contato: {
        Row: {
          ativo: boolean
          atualizado_em: string
          canal: string
          condicoes: Json
          criado_em: string
          descricao: string | null
          gatilho_tipo: string
          gatilho_valor: number
          id: string
          nome: string
          prompt_tipo: Database["public"]["Enums"]["prompt_tipo"]
          total_envios: number
          ultimo_envio_em: string | null
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          canal?: string
          condicoes?: Json
          criado_em?: string
          descricao?: string | null
          gatilho_tipo?: string
          gatilho_valor?: number
          id?: string
          nome: string
          prompt_tipo: Database["public"]["Enums"]["prompt_tipo"]
          total_envios?: number
          ultimo_envio_em?: string | null
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          canal?: string
          condicoes?: Json
          criado_em?: string
          descricao?: string | null
          gatilho_tipo?: string
          gatilho_valor?: number
          id?: string
          nome?: string
          prompt_tipo?: Database["public"]["Enums"]["prompt_tipo"]
          total_envios?: number
          ultimo_envio_em?: string | null
        }
        Relationships: []
      }
      prescricao_modelos: {
        Row: {
          atualizado_em: string
          criado_em: string
          criado_por: string | null
          descricao: string | null
          fitoterapicos: Json
          id: string
          nome: string
          observacoes: string | null
          posologia: string | null
          suplementos: Json
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          criado_por?: string | null
          descricao?: string | null
          fitoterapicos?: Json
          id?: string
          nome: string
          observacoes?: string | null
          posologia?: string | null
          suplementos?: Json
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          criado_por?: string | null
          descricao?: string | null
          fitoterapicos?: Json
          id?: string
          nome?: string
          observacoes?: string | null
          posologia?: string | null
          suplementos?: Json
        }
        Relationships: []
      }
      prescricoes: {
        Row: {
          aluno_id: string
          atualizado_em: string
          criado_em: string
          criado_por: string | null
          data: string | null
          descricao: string | null
          fitoterapicos: Json
          id: string
          observacoes: string | null
          posologia: string | null
          suplementos: Json
          titulo: string | null
        }
        Insert: {
          aluno_id: string
          atualizado_em?: string
          criado_em?: string
          criado_por?: string | null
          data?: string | null
          descricao?: string | null
          fitoterapicos?: Json
          id?: string
          observacoes?: string | null
          posologia?: string | null
          suplementos?: Json
          titulo?: string | null
        }
        Update: {
          aluno_id?: string
          atualizado_em?: string
          criado_em?: string
          criado_por?: string | null
          data?: string | null
          descricao?: string | null
          fitoterapicos?: Json
          id?: string
          observacoes?: string | null
          posologia?: string | null
          suplementos?: Json
          titulo?: string | null
        }
        Relationships: []
      }
      prompts_ia: {
        Row: {
          ativo: boolean
          atualizado_em: string
          id: string
          prompt_sistema: string
          tipo: Database["public"]["Enums"]["prompt_tipo"]
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          id?: string
          prompt_sistema: string
          tipo: Database["public"]["Enums"]["prompt_tipo"]
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          id?: string
          prompt_sistema?: string
          tipo?: Database["public"]["Enums"]["prompt_tipo"]
        }
        Relationships: []
      }
      respostas_rapidas: {
        Row: {
          ativo: boolean
          atualizado_em: string
          categoria: string
          criado_em: string
          id: string
          ordem: number
          texto: string
          titulo: string
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          categoria: string
          criado_em?: string
          id?: string
          ordem?: number
          texto: string
          titulo: string
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          categoria?: string
          criado_em?: string
          id?: string
          ordem?: number
          texto?: string
          titulo?: string
        }
        Relationships: []
      }
      skinfold_measurements: {
        Row: {
          abdominal: number | null
          assessment_id: string
          biceps: number | null
          chest: number | null
          created_at: string
          id: string
          medial_calf: number | null
          midaxillary: number | null
          subscapular: number | null
          suprailiac: number | null
          thigh: number | null
          triceps: number | null
          updated_at: string
        }
        Insert: {
          abdominal?: number | null
          assessment_id: string
          biceps?: number | null
          chest?: number | null
          created_at?: string
          id?: string
          medial_calf?: number | null
          midaxillary?: number | null
          subscapular?: number | null
          suprailiac?: number | null
          thigh?: number | null
          triceps?: number | null
          updated_at?: string
        }
        Update: {
          abdominal?: number | null
          assessment_id?: string
          biceps?: number | null
          chest?: number | null
          created_at?: string
          id?: string
          medial_calf?: number | null
          midaxillary?: number | null
          subscapular?: number | null
          suprailiac?: number | null
          thigh?: number | null
          triceps?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "skinfold_measurements_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: true
            referencedRelation: "physical_assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      source_reference: {
        Row: {
          description: string | null
          document: string | null
          edition_or_version: string | null
          source_name: string
          source_priority: number
        }
        Insert: {
          description?: string | null
          document?: string | null
          edition_or_version?: string | null
          source_name: string
          source_priority?: number
        }
        Update: {
          description?: string | null
          document?: string | null
          edition_or_version?: string | null
          source_name?: string
          source_priority?: number
        }
        Relationships: []
      }
      system_logs: {
        Row: {
          aluno_id: string | null
          aluno_nome: string | null
          created_at: string
          description: string | null
          error_message: string | null
          event_type: string
          id: string
          module: string | null
          notes: string | null
          payload_summary: Json
          resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          stack_trace: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          aluno_id?: string | null
          aluno_nome?: string | null
          created_at?: string
          description?: string | null
          error_message?: string | null
          event_type: string
          id?: string
          module?: string | null
          notes?: string | null
          payload_summary?: Json
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          stack_trace?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          aluno_id?: string | null
          aluno_nome?: string | null
          created_at?: string
          description?: string | null
          error_message?: string | null
          event_type?: string
          id?: string
          module?: string | null
          notes?: string | null
          payload_summary?: Json
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          stack_trace?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      transacoes: {
        Row: {
          aluno_id: string | null
          banco: string | null
          categoria_id: string | null
          competencia: string
          criado_em: string
          criado_por: string | null
          data_transacao: string | null
          descricao: string | null
          fitid: string | null
          id: string
          origem: string
          referencia: string | null
          tipo: string
          valor: number
        }
        Insert: {
          aluno_id?: string | null
          banco?: string | null
          categoria_id?: string | null
          competencia: string
          criado_em?: string
          criado_por?: string | null
          data_transacao?: string | null
          descricao?: string | null
          fitid?: string | null
          id?: string
          origem: string
          referencia?: string | null
          tipo: string
          valor: number
        }
        Update: {
          aluno_id?: string | null
          banco?: string | null
          categoria_id?: string | null
          competencia?: string
          criado_em?: string
          criado_por?: string | null
          data_transacao?: string | null
          descricao?: string | null
          fitid?: string | null
          id?: string
          origem?: string
          referencia?: string | null
          tipo?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "transacoes_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transacoes_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "financeiro_categorias"
            referencedColumns: ["id"]
          },
        ]
      }
      usuarios_crm: {
        Row: {
          ativo: boolean
          criado_em: string
          email: string | null
          id: string
          nome: string | null
          perfil: Database["public"]["Enums"]["app_role"]
          telefone: string | null
        }
        Insert: {
          ativo?: boolean
          criado_em?: string
          email?: string | null
          id: string
          nome?: string | null
          perfil?: Database["public"]["Enums"]["app_role"]
          telefone?: string | null
        }
        Update: {
          ativo?: boolean
          criado_em?: string
          email?: string | null
          id?: string
          nome?: string | null
          perfil?: Database["public"]["Enums"]["app_role"]
          telefone?: string | null
        }
        Relationships: []
      }
      workflow_config: {
        Row: {
          atualizado_em: string
          atualizado_por: string | null
          chave: string
          id: string
          secao: string
          tipo: string
          valor: string | null
        }
        Insert: {
          atualizado_em?: string
          atualizado_por?: string | null
          chave: string
          id?: string
          secao: string
          tipo: string
          valor?: string | null
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string | null
          chave?: string
          id?: string
          secao?: string
          tipo?: string
          valor?: string | null
        }
        Relationships: []
      }
      zapi_webhook_eventos: {
        Row: {
          chave_idempotencia: string
          concluido_em: string | null
          id: string
          recebido_em: string
          resultado: Json | null
          status: string
          telefone: string | null
          tipo: string
        }
        Insert: {
          chave_idempotencia: string
          concluido_em?: string | null
          id?: string
          recebido_em?: string
          resultado?: Json | null
          status?: string
          telefone?: string | null
          tipo?: string
        }
        Update: {
          chave_idempotencia?: string
          concluido_em?: string | null
          id?: string
          recebido_em?: string
          resultado?: Json | null
          status?: string
          telefone?: string | null
          tipo?: string
        }
        Relationships: []
      }
    }
    Views: {
      weekly_checkin_stats: {
        Row: {
          aluno_id: string | null
          media_energia_7d: number | null
          media_humor_7d: number | null
          media_sono_7d: number | null
          total_checkins_7d: number | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_checkins_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      admin_historico_cron_job: {
        Args: { _jobname: string; _limit?: number }
        Returns: {
          end_time: string
          jobid: number
          return_message: string
          runid: number
          start_time: string
          status: string
        }[]
      }
      admin_kpis_cron_jobs: {
        Args: never
        Returns: {
          fail_24h: number
          ok_24h: number
          ultima_falha_em: string
          ultima_falha_jobname: string
        }[]
      }
      admin_listar_cron_jobs: {
        Args: never
        Returns: {
          active: boolean
          command: string
          jobid: number
          jobname: string
          schedule: string
        }[]
      }
      admin_rodar_cron_job: { Args: { _jobname: string }; Returns: Json }
      agendar_ciclos_alunos_ativos: { Args: never; Returns: Json }
      agendar_jobs_apos_entrega: {
        Args: { _aluno_id: string; _d0: string }
        Returns: undefined
      }
      buscar_aluno_por_telefone: {
        Args: { _telefone: string }
        Returns: {
          id: string
          nome: string
        }[]
      }
      calcular_data_limite_entrega: {
        Args: { data_base: string }
        Returns: string
      }
      get_aluno_dashboard: { Args: { _aluno_id: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      immutable_unaccent: { Args: { "": string }; Returns: string }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_crm_user: { Args: { _user_id: string }; Returns: boolean }
      is_equipe_or_admin: { Args: { _user_id: string }; Returns: boolean }
      next_brt_16h: { Args: { base: string }; Returns: string }
      next_brt_8am: { Args: { base: string }; Returns: string }
      next_brt_business_window: { Args: { base: string }; Returns: string }
      normalizar_telefone_br: { Args: { _telefone: string }; Returns: string }
      recalcular_score_dia: {
        Args: { _aluno_id: string; _data: string }
        Returns: number
      }
    }
    Enums: {
      aluno_modalidade: "mpteam" | "mp_elite" | "mp_presencial"
      aluno_servico: "treino_e_dieta" | "dieta" | "treino"
      aluno_status:
        | "aguardando_anamnese"
        | "anamnese_recebida"
        | "em_producao"
        | "ativo"
        | "aguardando_renovacao"
        | "renovado"
        | "cancelado"
      app_role: "admin" | "equipe" | "visualizador" | "consultor"
      envio_status: "enviado" | "erro" | "pendente" | "descartado"
      formulario_tipo:
        | "anamnese"
        | "feedback_quinzenal"
        | "check_shape"
        | "feedback_mensal"
      job_tipo:
        | "boas_vindas"
        | "link_anamnese"
        | "d1"
        | "d7"
        | "d15_formulario"
        | "d21"
        | "d27"
        | "d29"
        | "d30"
        | "d31"
        | "ia_feedback_quinzenal"
        | "ia_check_shape"
        | "resumo_diario"
        | "anamnese_confirmacao"
        | "followup_d7"
        | "feedback_quinzenal_link"
        | "followup_d21"
        | "feedback_mensal_link"
        | "feedback_quinzenal_resposta"
        | "feedback_mensal_resposta"
        | "pos_feedback_mensal"
        | "aniversario"
        | "feedback_link_lembrete"
        | "pos_entrega_d1"
        | "push_lembrete"
        | "novo_aluno_admin"
      prompt_tipo:
        | "feedback_quinzenal"
        | "check_shape"
        | "treino"
        | "anamnese"
        | "feedback_mensal"
        | "followup_d7"
        | "followup_d21"
        | "estrategia_treino"
        | "estrategia_nutricional"
        | "check_shape_mensal"
        | "anamnese_recebida"
        | "feedback_quinzenal_lembrete"
      template_modalidade: "mpteam" | "mp_elite" | "mp_presencial" | "todas"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      aluno_modalidade: ["mpteam", "mp_elite", "mp_presencial"],
      aluno_servico: ["treino_e_dieta", "dieta", "treino"],
      aluno_status: [
        "aguardando_anamnese",
        "anamnese_recebida",
        "em_producao",
        "ativo",
        "aguardando_renovacao",
        "renovado",
        "cancelado",
      ],
      app_role: ["admin", "equipe", "visualizador", "consultor"],
      envio_status: ["enviado", "erro", "pendente", "descartado"],
      formulario_tipo: [
        "anamnese",
        "feedback_quinzenal",
        "check_shape",
        "feedback_mensal",
      ],
      job_tipo: [
        "boas_vindas",
        "link_anamnese",
        "d1",
        "d7",
        "d15_formulario",
        "d21",
        "d27",
        "d29",
        "d30",
        "d31",
        "ia_feedback_quinzenal",
        "ia_check_shape",
        "resumo_diario",
        "anamnese_confirmacao",
        "followup_d7",
        "feedback_quinzenal_link",
        "followup_d21",
        "feedback_mensal_link",
        "feedback_quinzenal_resposta",
        "feedback_mensal_resposta",
        "pos_feedback_mensal",
        "aniversario",
        "feedback_link_lembrete",
        "pos_entrega_d1",
        "push_lembrete",
        "novo_aluno_admin",
      ],
      prompt_tipo: [
        "feedback_quinzenal",
        "check_shape",
        "treino",
        "anamnese",
        "feedback_mensal",
        "followup_d7",
        "followup_d21",
        "estrategia_treino",
        "estrategia_nutricional",
        "check_shape_mensal",
        "anamnese_recebida",
        "feedback_quinzenal_lembrete",
      ],
      template_modalidade: ["mpteam", "mp_elite", "mp_presencial", "todas"],
    },
  },
} as const
