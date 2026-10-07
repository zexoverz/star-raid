// Injected into the page before any app code: a minimal EIP-1193 wallet (EIP-6963 announced) that
// forwards every request to a local anvil fork where the account is an unlocked dev account.
// Recording only: no keys in the page, nothing touches a real chain.
;(() => {
  const RPC = window.__REC_RPC__
  const ACCOUNT = window.__REC_ACCOUNT__
  const CHAIN = '0x279f' // 10143, Monad testnet (forked)
  const listeners = {}
  let id = 1
  const rpc = async (method, params = []) => {
    const r = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: id++, method, params }) })
    const j = await r.json()
    if (j.error) throw Object.assign(new Error(j.error.message), { code: j.error.code, data: j.error.data })
    return j.result
  }
  const provider = {
    isMetaMask: false,
    isStarRaidRecorder: true,
    async request({ method, params }) {
      switch (method) {
        case 'eth_requestAccounts':
        case 'eth_accounts':
          return [ACCOUNT]
        case 'eth_chainId':
          return CHAIN
        case 'net_version':
          return '10143'
        case 'wallet_switchEthereumChain':
        case 'wallet_addEthereumChain':
        case 'wallet_watchAsset':
          return null
        case 'wallet_requestPermissions':
        case 'wallet_getPermissions':
          return [{ parentCapability: 'eth_accounts' }]
        case 'wallet_getCapabilities':
          return {}
        case 'personal_sign':
        case 'eth_signTypedData_v4':
        case 'eth_sendTransaction':
          window.__REC_TX__ = (window.__REC_TX__ ?? 0) + 1
          return rpc(method, params)
        default:
          return rpc(method, params)
      }
    },
    on(ev, fn) {
      ;(listeners[ev] ??= []).push(fn)
    },
    removeListener(ev, fn) {
      listeners[ev] = (listeners[ev] ?? []).filter((f) => f !== fn)
    },
  }
  window.ethereum = provider
  const info = { uuid: 'b6f0b7a4-5a1e-4c6e-9e0e-recorder0001', name: 'Test Wallet', icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="%23ff8c42"/></svg>', rdns: 'xyz.starraid.recorder' }
  const announce = () => window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail: Object.freeze({ info, provider }) }))
  window.addEventListener('eip6963:requestProvider', announce)
  announce()
})()
