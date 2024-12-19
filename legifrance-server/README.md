# MCP Server Legifrance

Un serveur MCP (Model Context Protocol) pour interagir avec l'API Légifrance.

## Installation

1. Clonez ce dépôt
2. Installez les dépendances :
```bash
npm install
```
3. Compilez le serveur :
```bash
npm run build
```

## Configuration

### 1. Obtenir les identifiants API

1. Créez un compte sur [PISTE](https://piste.gouv.fr)
2. Allez dans "Mes applications" et cliquez sur "Créer une application"
3. Sélectionnez l'API "API Légifrance"
4. Choisissez l'environnement :
   - **Sandbox** (recommandé pour les tests)
   - Production (nécessite une validation par l'équipe PISTE)
5. Notez les identifiants fournis :
   - Client ID
   - Client Secret
   - API Key
   - OAuth Secret

### 2. Configurer le serveur MCP

1. Copiez le fichier `config.example.json` et renommez-le en `claude_desktop_config.json`
2. Placez-le dans le dossier de configuration de Claude Desktop :
   - Windows : `%APPDATA%\Claude\`
   - macOS : `~/Library/Application Support/Claude/`
   - Linux : `~/.config/Claude/`
3. Remplacez les valeurs d'exemple par vos identifiants :
   ```json
   {
     "mcpServers": {
       "legifrance-server": {
         "command": "node",
         "args": ["chemin/absolu/vers/legifrance-server/build/index.js"],
         "env": {
           "LEGIFRANCE_CLIENT_ID": "votre_client_id",
           "LEGIFRANCE_CLIENT_SECRET": "votre_client_secret",
           "LEGIFRANCE_API_KEY": "votre_api_key",
           "LEGIFRANCE_OAUTH_SECRET": "votre_oauth_secret",
           "LEGIFRANCE_API_URL": "...",  // URL selon votre environnement
           "OAUTH_TOKEN_URL": "..."      // URL selon votre environnement
         }
       }
     }
   }
   ```

> **Important** : Ne partagez jamais vos identifiants API. Le fichier `claude_desktop_config.json` contenant vos clés ne doit pas être commité dans Git.

## Utilisation

Une fois configuré et lancé via Claude Desktop, vous pouvez utiliser le serveur pour rechercher dans la base Légifrance. Par exemple :

```
Cherche les articles concernant "droit du travail" dans Légifrance
```

## Développement

Pour contribuer au développement :

1. Fork le projet
2. Créez une branche pour votre fonctionnalité
3. Committez vos changements
4. Poussez vers la branche
5. Créez une Pull Request

## Environnements

Le serveur peut être utilisé avec deux environnements de l'API Légifrance :

### Sandbox (Recommandé pour les tests)
```json
{
  "LEGIFRANCE_API_URL": "https://sandbox-api.piste.gouv.fr/dila/legifrance/lf-engine-app",
  "OAUTH_TOKEN_URL": "https://sandbox-oauth.piste.gouv.fr/api/oauth/token"
}
```

### Production
```json
{
  "LEGIFRANCE_API_URL": "https://api.piste.gouv.fr/dila/legifrance/lf-engine-app",
  "OAUTH_TOKEN_URL": "https://oauth.piste.gouv.fr/api/oauth/token"
}
```

## Licence

MIT - Voir le fichier [LICENSE](LICENSE) pour plus de détails.
