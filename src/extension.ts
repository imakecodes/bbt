import * as vscode from 'vscode'
import * as https from 'https'

let items: Map<string, vscode.StatusBarItem>
let interval

const markets = [
    {
        'id': 'foxbit',
        'subTicker': false,
        'label': 'Foxbit',
        'currency': 'BRL',
        'locale': 'pt-BR',
        'url': `https://api.blinktrade.com/api/v1/BRL/ticker`
    }, {
        'id': 'mbtc',
        'subTicker': true,
        'label': 'Mercado Bitcoin',
        'currency': 'BRL',
        'locale': 'pt-BR',
        'url': `https://www.mercadobitcoin.com.br/api/ticker/`
    }, {
        'id': 'btc2you',
        'subTicker': true,
        'label': 'Bitcoin to You',
        'currency': 'BRL',
        'locale': 'pt-BR',
        'url': `https://www.bitcointoyou.com/api/ticker.aspx`
    }
]

// Configurações do workspace
const config = vscode.workspace.getConfiguration()

function onWorkspaceSettingsUpdate(): void {
    vscode.workspace.onDidChangeConfiguration(params => {
        cleanup()
        return refresh()
    });
}

export function activate(context: vscode.ExtensionContext) {
  
    // Itens da barra de status
    items = new Map<string, vscode.StatusBarItem>();

    // Carregando os dados dos mercados
    refresh()

    // Sempre que atualizar as configurações
    context.subscriptions.push(onWorkspaceSettingsUpdate())

   
    // Setando o tempo de atualização (default: 60 segundos)
    const refreshTime = config.get('bbt.refreshTime', 60)
    interval = setInterval(refresh, refreshTime*1e3)
}

// this method is called when your extension is deactivated
export function deactivate() {

    // Destavia a atualização dinâmica em caso do usuário destabilitar a extensão
    interval.clearInterval()
}

/**
 * Retorna o objeto do mercado requerido
 * @param id string
 */
function getMarket(id) {
    let market = null
    markets
    .forEach((m, i) => {
        if (m['id'] == id) {
            market = m
        }
    })
    return market
}

/**
 * Atualiza todos os mercados
 */
function refresh(): void {
    let configMarkets = config.get('bbt.markets', ["foxbit", "mbtc", "btc2you"])
    let enabledMarkets = []
    let marketsControl = []
    markets
        .forEach((market, i) => {
            if (configMarkets.indexOf(market['id']) > -1) {
                enabledMarkets.push(market)
                marketsControl.push(market['id'])
            }
        })
    if (!arrayEq(marketsControl, Array.from(items.keys()))) {
        cleanup()
        fillEmpty(enabledMarkets)
    }

    refreshMarkets(enabledMarkets)
}


function fillEmpty(symbols: object[]): void {
    symbols
        .forEach((market, i) => {
            // Enforce ordering with priority
            const priority = symbols.length - i
            const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, priority)
            item.text = `${market['label']}: …`
            item.show()
            items.set(market['id'], item)
        })
}

function cleanup(): void {
    // TODO
    /*
    markets.forEach(market => {
        let item = items.get(market['id'])
        if (item) {
            items.delete(market['id'])
        }        
    })

    items = new Map<string, vscode.StatusBarItem>()*/
}

/**
 * Atualiza os dados dos mercados
 * @param symbols object[]
 */
function refreshMarkets(symbols: object[]): void {
    // Percorrendo os mercados para atualizar os valores
    symbols.forEach((market, i) => {
        httpGet(market['url']).then(response => {
            
            // Parse do json retornado
            response = JSON.parse(response)
            
            // Verificando se o retorno precisa acessar um objeto "ticker"
            if (market['subTicker']) {
                updateItemWithSymbolResult(response['ticker']['last'], market)
            } else {
                updateItemWithSymbolResult(response['last'], market)
            }
            
        }).catch(e => console.error(e))
    })	
}

function updateItemWithSymbolResult(last, market) {
    
    // Formatando para Real Brasileiro (BRL)
    last = new Intl.NumberFormat(market['locale'], { style: 'currency', currency: market['currency'] }).format(last)

    // Selecionando o item na barra de status
    const item = items.get(market['id'])
    
    // Atualizando o texto do item
	item.text = `${market['label']}: ${last}`

    /*
    TODO
    const useColors = config.get('bbt.useColors', true)
    if (useColors) {
        const change = parseFloat(last)
        const color = change > 0 ? 'lightgreen' :
            change < 0 ? 'pink':
            'white'
        item.color = color
    } else {
        item.color = undefined
    }*/
}

function httpGet(url): Promise<string> {
    return new Promise((resolve, reject) => {
        https.get(url, response => {
            let responseData = '';
            response.on('data', chunk => responseData += chunk);
            response.on('end', () => {
                // Sometimes the 'error' event is not fired. Double check here.
                if (response.statusCode === 200) {
                    resolve(responseData)
                } else {
                    reject('fail: ' + response.statusCode)
                }
            })
        })
    })
}

function arrayEq(arr1: any[], arr2: any[]): boolean {
    if (arr1.length !== arr2.length) return false

    return !arr1.some((item, i) => item !== arr2[i])
}
