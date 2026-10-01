
const CLIENT_ID = '1546182857364607076';
const TARGET_SERVER_ID = '1545048902032556173';
const REQUIRED_ROLE_ID = '1549026062015529031';

const REDIRECT_URI = window.location.origin + window.location.pathname;

const LINK_LIST = [
    {
        id: 1,
        title: '公式 Discord コミュニティ',
        url: 'https://discord.gg/9hZdjpQAw',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        description: 'Link Member 限定コミュニティサーバーです。メンバー同士の交流を行っています。'
    },
    {
        id: 2,
        title: 'VIP 会員専用 ポータルサイト',
        url: 'https://example.com/vip-portal',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
        description: '限定ロールを保有しているメンバーのみがアクセス可能な専用ダウンロードポータル。'
    },
    {
        id: 3,
        title: 'お問い合わせ & サポート',
        url: 'https://example.com/support',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
        description: '権限に関する質問やエラーのトラブルシューティングを受け付けている窓口です。'
    }
];

let currentUser = null;
let userRoles = [];
let savedLinkIds = JSON.parse(localStorage.getItem('saved_link_ids') || '[]');

const ui = {};

function h(tag, props, ...children) {
    const el = document.createElement(tag);
    for (const [key, value] of Object.entries(props || {})) {
        if (value === null || value === undefined || value === false) continue;
        if (key === 'class') {
            el.className = value;
        } else if (key.startsWith('on') && typeof value === 'function') {
            el.addEventListener(key.slice(2), value);
        } else {
            el.setAttribute(key, value === true ? '' : value);
        }
    }
    appendChildren(el, children);
    return el;
}

function appendChildren(el, children) {
    children.forEach(child => {
        if (child === null || child === undefined || child === false) return;
        if (Array.isArray(child)) {
            appendChildren(el, child);
        } else if (child instanceof Node) {
            el.appendChild(child);
        } else {
            el.appendChild(document.createTextNode(String(child)));
        }
    });
}

const icon = (cls) => h('i', { class: cls });

function buildHeader() {
    ui.navAvatar = h('img', { alt: 'Avatar', class: 'w-full h-full object-cover' });
    ui.menuUserName = h('p', { class: 'text-xs font-bold text-white truncate' });
    ui.menuUserId = h('p', { class: 'text-[9px] text-gray-400 font-mono truncate' });

    const menuItem = (iconCls, activeCls, label, onClick) =>
        h('button', {
            class: `w-full text-left px-4 py-2 text-xs text-gray-200 ${activeCls} flex items-center space-x-3 transition cursor-pointer`,
            onclick: onClick
        }, icon(`${iconCls} w-4`), h('span', { class: 'font-bold' }, label));

    ui.dropdown = h('div', {
        class: 'hidden absolute right-0 mt-2 w-52 bg-[#0f1017] border border-gray-800 rounded-2xl shadow-2xl overflow-hidden py-2 z-50'
    },
        h('div', { class: 'px-4 py-2.5 border-b border-gray-800/80' }, ui.menuUserName, ui.menuUserId),
        h('div', { class: 'py-1' },
            menuItem('fa-solid fa-gear text-indigo-400', 'active:bg-indigo-600/30', 'アカウント設定', () => switchView('account-settings')),
            menuItem('fa-solid fa-bookmark text-amber-400', 'active:bg-amber-600/30', '保存したリンク', () => switchView('saved-links')),
            menuItem('fa-solid fa-list-check text-emerald-400', 'active:bg-emerald-600/30', 'All Link 一覧', () => switchView('all-links'))
        ),
        h('div', { class: 'border-t border-gray-800/80 pt-1 mt-1' },
            h('button', {
                class: 'w-full text-left px-4 py-2 text-xs text-red-500 active:bg-red-950/40 font-bold flex items-center space-x-3 transition cursor-pointer',
                onclick: logout
            }, icon('fa-solid fa-right-from-bracket w-4'), h('span', null, 'ログアウト')))
    );

    ui.header = h('header', { class: 'hidden fixed top-3 right-3 z-50' },
        h('div', { class: 'relative' },
            h('button', {
                class: 'w-10 h-10 rounded-full border-2 border-[#5865F2] overflow-hidden focus:outline-none shadow-lg active:scale-95 transition cursor-pointer',
                onclick: toggleUserMenu
            }, ui.navAvatar),
            ui.dropdown
        )
    );
    return ui.header;
}

function buildLoginView() {
    return h('section', { class: 'flex flex-col items-center justify-center w-full h-full my-auto' },
        h('button', {
            class: 'discord-btn px-8 py-4 sm:px-10 sm:py-4 rounded-2xl text-base sm:text-lg font-extrabold flex items-center justify-center space-x-3 tracking-wider select-none cursor-pointer active:scale-95',
            onclick: loginWithDiscord
        }, icon('fa-brands fa-discord text-xl sm:text-2xl'), h('span', null, 'Discordでログイン'))
    );
}

function buildAuthStatusView() {
    ui.checkingLoader = h('div', { class: 'py-10' },
        icon('fa-solid fa-circle-notch fa-spin text-3xl text-[#5865F2] mb-3'),
        h('p', { class: 'text-xs font-semibold text-gray-300' }, 'サーバー権限を確認中...')
    );

    ui.errorText = h('p', { class: 'mt-1 text-[11px] font-mono break-all' });
    ui.errorBox = h('div', { class: 'hidden p-3 mb-4 bg-red-900/50 border border-red-500/80 rounded-xl text-red-200 text-xs text-left' },
        h('p', { class: 'font-bold flex items-center' }, icon('fa-solid fa-circle-exclamation mr-1.5'), 'エラーが発生しました'),
        ui.errorText
    );

    ui.userAvatar = h('img', {
        alt: 'Avatar',
        class: 'w-16 h-16 rounded-full mx-auto mb-2 border-2 border-[#5865F2] shadow-[0_0_15px_rgba(88,101,242,0.5)]'
    });
    ui.userName = h('h1', { class: 'text-lg font-extrabold text-white' });
    ui.userId = h('p', { class: 'text-[10px] text-indigo-300/70 font-mono mt-0.5 mb-4' });

    ui.noRoleView = h('div', { class: 'hidden space-y-3 my-4 p-4 bg-red-950/40 border border-red-500/50 rounded-2xl' },
        h('p', { class: 'text-red-500 font-black text-base sm:text-lg tracking-wide' },
            icon('fa-solid fa-triangle-exclamation mr-1'), 'Link Memberロールがありません'),
        h('div', { class: 'text-xs text-gray-300 space-y-1' },
            h('a', {
                href: 'https://discord.gg/9hZdjpQAw',
                target: '_blank',
                rel: 'noopener noreferrer',
                class: 'text-red-400 hover:text-red-300 underline font-bold break-all block py-1'
            }, 'https://discord.gg/9hZdjpQAw'),
            h('p', null, '権限を購入してください'))
    );

    ui.hasRoleView = h('div', { class: 'hidden space-y-4 my-4' },
        h('div', { class: 'inline-flex items-center space-x-1.5 px-3 py-1 bg-emerald-950/60 border border-emerald-500/60 rounded-full text-emerald-400 font-extrabold text-sm tracking-wider' },
            icon('fa-solid fa-shield-halved'), h('span', null, 'Link Member')),
        h('div', null,
            h('button', {
                class: 'w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 text-gray-950 font-black text-base tracking-wider cursor-pointer shadow-[0_0_20px_rgba(16,185,129,0.4)] active:scale-95 transition flex items-center justify-center space-x-2',
                onclick: () => switchView('all-links')
            }, icon('fa-solid fa-list-check text-lg'), h('span', null, 'All Link')))
    );

    ui.statusContent = h('div', { class: 'hidden' },
        ui.userAvatar, ui.userName, ui.userId, ui.noRoleView, ui.hasRoleView);

    return h('section', { class: 'hidden w-full max-w-md my-auto' },
        h('div', { class: 'glass-panel rounded-3xl p-6 text-center shadow-[0_0_50px_rgba(88,101,242,0.15)] relative' },
            ui.checkingLoader, ui.errorBox, ui.statusContent)
    );
}

function panelHeader(iconBox, iconCls, title) {
    return h('div', { class: 'flex items-center justify-between pb-4 border-b border-gray-800 mb-4' },
        h('div', { class: 'flex items-center space-x-2' },
            h('div', { class: `w-8 h-8 rounded-lg ${iconBox} flex items-center justify-center` }, icon(`${iconCls} text-sm`)),
            h('h2', { class: 'text-base font-black text-white' }, title)),
        h('button', {
            class: 'px-3 py-1 bg-gray-800 hover:bg-gray-700 text-[11px] text-gray-300 rounded-lg transition cursor-pointer',
            onclick: () => switchView('all-links')
        }, icon('fa-solid fa-arrow-left mr-1'), '戻る')
    );
}

function buildAccountSettingsView() {
    ui.accAvatar = h('img', {
        alt: 'Avatar',
        class: 'w-16 h-16 rounded-full border-2 border-indigo-500 mb-2 shadow-[0_0_15px_rgba(99,102,241,0.3)]'
    });
    ui.accUsername = h('h3', { class: 'text-base font-bold text-white' });
    ui.accId = h('p', { class: 'text-[10px] text-indigo-300 font-mono mt-0.5' });
    ui.accRoles = h('div', { class: 'flex flex-wrap gap-1.5' });

    return h('section', { class: 'hidden w-full my-4' },
        h('div', { class: 'glass-panel rounded-3xl p-5 border border-indigo-500/30' },
            panelHeader('bg-indigo-500/20 border border-indigo-500/40 text-indigo-400', 'fa-solid fa-user-gear', 'アカウント設定'),
            h('div', { class: 'space-y-4' },
                h('div', { class: 'bg-gray-900/80 border border-gray-800 rounded-2xl p-4 text-center flex flex-col items-center justify-center' },
                    ui.accAvatar, ui.accUsername, ui.accId),
                h('div', { class: 'bg-gray-900/80 border border-gray-800 rounded-2xl p-4' },
                    h('h4', { class: 'text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center' },
                        icon('fa-solid fa-id-badge text-indigo-400 mr-1.5'), '所持しているロール'),
                    ui.accRoles)
            )
        )
    );
}

function buildSavedLinksView() {
    ui.savedContainer = h('div', { class: 'space-y-3' });
    return h('section', { class: 'hidden w-full my-4' },
        h('div', { class: 'glass-panel rounded-3xl p-5 border border-amber-500/30' },
            panelHeader('bg-amber-500/20 border border-amber-500/40 text-amber-400', 'fa-solid fa-bookmark', '保存したリンク'),
            ui.savedContainer)
    );
}

function buildAllLinksView() {
    ui.allContainer = h('div', { class: 'space-y-3' });
    return h('section', { class: 'hidden w-full my-4' }, ui.allContainer);
}

function buildApp() {
    document.body.className = 'bg-black text-white min-h-[100dvh] h-[100dvh] flex flex-col justify-between relative overflow-x-hidden';
    document.body.innerHTML = '';

    ui.views = {
        'login': buildLoginView(),
        'auth-status': buildAuthStatusView(),
        'account-settings': buildAccountSettingsView(),
        'saved-links': buildSavedLinksView(),
        'all-links': buildAllLinksView()
    };

    const main = h('main', { class: 'flex-grow flex items-center justify-center p-3 relative z-10 w-full max-w-2xl mx-auto h-full' },
        Object.values(ui.views));

    document.body.append(buildHeader(), main);
}

function switchView(viewName) {

    if (viewName === 'login') {
        document.body.classList.add('h-[100dvh]', 'overflow-hidden');
    } else {
        document.body.classList.remove('h-[100dvh]', 'overflow-hidden');
    }

    Object.entries(ui.views).forEach(([name, el]) => {
        el.classList.toggle('hidden', name !== viewName);
    });

    ui.dropdown.classList.add('hidden');

    if (viewName === 'all-links') renderAllLinks();
    if (viewName === 'saved-links') renderSavedLinks();
}

function updateUserInfoUI(user) {
    const avatarUrl = user.avatar
        ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
        : 'https://cdn.discordapp.com/embed/avatars/0.png';
    const idText = `ID: ${user.id}`;

    ui.navAvatar.src = avatarUrl;
    ui.menuUserName.textContent = user.username;
    ui.menuUserId.textContent = idText;

    ui.userAvatar.src = avatarUrl;
    ui.userName.textContent = user.username;
    ui.userId.textContent = idText;

    ui.accAvatar.src = avatarUrl;
    ui.accUsername.textContent = user.username;
    ui.accId.textContent = idText;
}

function updateRolesUI(roles) {
    ui.accRoles.innerHTML = '';

    if (!roles || roles.length === 0) {
        ui.accRoles.appendChild(h('span', { class: 'text-xs text-gray-500' }, '所有ロールはありません'));
        return;
    }

    roles.forEach(roleId => {
        const isRequired = roleId === REQUIRED_ROLE_ID;
        ui.accRoles.appendChild(h('span', {
            class: isRequired
                ? 'px-2 py-0.5 bg-emerald-500/20 border border-emerald-500/40 rounded text-emerald-300 font-bold text-[10px]'
                : 'px-2 py-0.5 bg-indigo-500/20 border border-indigo-500/40 rounded text-indigo-300 font-mono text-[10px]'
        }, isRequired ? `★ Link Member (${roleId})` : `ID: ${roleId}`));
    });
}

function toggleUserMenu() {
    ui.dropdown.classList.toggle('hidden');
}

function showError(msg) {
    ui.errorText.textContent = msg;
    ui.errorBox.classList.remove('hidden');
}

function loginWithDiscord() {

    const scope = encodeURIComponent('identify guilds guilds.members.read');
    const redirect = encodeURIComponent(REDIRECT_URI);
    const authUrl = `https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&response_type=token&redirect_uri=${redirect}&scope=${scope}`;
    window.location.href = authUrl;
}

async function handleOAuthCallback() {
    let accessToken = null;

    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);

    if (params.has('access_token')) {
        accessToken = params.get('access_token');
        sessionStorage.setItem('discord_access_token', accessToken);

        history.replaceState(null, null, window.location.pathname);
    } else {
        accessToken = sessionStorage.getItem('discord_access_token');
    }

    if (!accessToken) {
        switchView('login');
        return;
    }

    switchView('auth-status');

    try {

        const userRes = await fetch('https://discord.com/api/v10/users/@me', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        if (!userRes.ok) {
            sessionStorage.removeItem('discord_access_token');
            throw new Error('認証トークンの期限が切れました。再ログインしてください。');
        }

        currentUser = await userRes.json();
        updateUserInfoUI(currentUser);

        let hasRole = false;
        try {
            const memberRes = await fetch(`https://discord.com/api/v10/users/@me/guilds/${TARGET_SERVER_ID}/member`, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });

            if (memberRes.ok) {
                const memberData = await memberRes.json();
                userRoles = memberData.roles || [];
                updateRolesUI(userRoles);
                if (userRoles.includes(REQUIRED_ROLE_ID)) {
                    hasRole = true;
                }
            }
        } catch (err) {
            console.error('ロール取得失敗:', err);
        }

        ui.checkingLoader.classList.add('hidden');
        ui.statusContent.classList.remove('hidden');
        ui.header.classList.remove('hidden');

        if (hasRole) {
            ui.hasRoleView.classList.remove('hidden');

            switchView('all-links');
        } else {
            ui.noRoleView.classList.remove('hidden');
        }

    } catch (error) {
        console.error('認証エラー:', error);
        showError(error.message);
        sessionStorage.removeItem('discord_access_token');
    }
}

function logout() {
    sessionStorage.removeItem('discord_access_token');
    currentUser = null;
    userRoles = [];
    ui.header.classList.add('hidden');
    switchView('login');
}

function videoThumb(link, boxCls, videoCls) {
    const video = h('video', {
        src: `${link.videoUrl}#t=0.001`,
        preload: 'metadata',
        playsinline: true,
        class: videoCls
    });
    video.muted = true;
    return video;
}

function renderAllLinks() {
    ui.allContainer.innerHTML = '';

    LINK_LIST.forEach(link => {
        const isSaved = savedLinkIds.includes(link.id);

        const card = h('div', {
            id: `link-card-${link.id}`,
            class: 'p-3 bg-gray-900/90 border border-gray-800 rounded-2xl relative flex items-center space-x-3 group shadow-lg'
        },
            h('div', { class: 'relative w-16 h-24 rounded-lg overflow-hidden bg-black shrink-0 border border-gray-800 flex items-center justify-center' },
                videoThumb(link, '', 'w-full h-full object-contain bg-black pointer-events-none'),
                h('div', { class: 'absolute bottom-1 left-1 right-1 flex justify-center pointer-events-none' },
                    h('span', { class: 'text-[8px] text-gray-300 font-mono bg-black/80 px-1 rounded' }, '0:00'))
            ),
            h('div', { class: 'flex-1 min-w-0 pr-6' },
                h('h3', { class: 'text-white font-bold text-xs truncate' }, link.title),
                h('p', { class: 'text-[11px] text-gray-400 mt-0.5 line-clamp-2 leading-tight' }, link.description),
                h('div', { class: 'mt-1.5' },
                    h('a', {
                        href: link.url,
                        target: '_blank',
                        rel: 'noopener noreferrer',
                        class: 'text-[10px] text-emerald-400 hover:text-emerald-300 underline break-all inline-flex items-center space-x-1 font-mono'
                    },
                        h('span', { class: 'truncate' }, link.url),
                        icon('fa-solid fa-arrow-up-right-from-square text-[8px] ml-1 shrink-0')))
            ),
            h('button', {
                class: 'absolute top-2 right-2 text-sm p-1.5 active:scale-125 transition cursor-pointer',
                onclick: () => toggleSaveLink(link.id)
            }, icon(isSaved ? 'fa-solid fa-bookmark text-amber-400' : 'fa-regular fa-bookmark text-gray-500'))
        );

        ui.allContainer.appendChild(card);
    });
}

function renderSavedLinks() {
    ui.savedContainer.innerHTML = '';

    const savedItems = LINK_LIST.filter(link => savedLinkIds.includes(link.id));

    if (savedItems.length === 0) {
        ui.savedContainer.appendChild(
            h('div', { class: 'text-center py-8 text-gray-500' },
                icon('fa-regular fa-bookmark text-2xl mb-1 block'),
                h('p', { class: 'text-xs' }, '保存されているリンクはありません'))
        );
        return;
    }

    savedItems.forEach(link => {
        const card = h('div', { class: 'p-2.5 bg-gray-900/90 border border-amber-500/20 rounded-xl flex items-center justify-between space-x-2' },
            h('div', { class: 'flex items-center space-x-2.5 min-w-0 flex-1' },
                h('div', { class: 'w-12 h-16 rounded-md overflow-hidden bg-black shrink-0 border border-gray-800 flex items-center justify-center' },
                    videoThumb(link, '', 'w-full h-full object-contain bg-black')),
                h('div', { class: 'min-w-0 flex-1' },
                    h('h4', { class: 'text-xs font-bold text-white truncate' }, link.title),
                    h('p', { class: 'text-[10px] text-gray-400 ellipsis-text mt-0.5 pr-1' }, link.description))
            ),
            h('button', {
                class: 'px-2.5 py-1.5 bg-amber-500/20 active:bg-amber-500/40 border border-amber-500/40 text-amber-300 font-bold text-[10px] rounded-lg transition shrink-0 flex items-center space-x-1 cursor-pointer',
                onclick: () => scrollToLinkInAllLinks(link.id)
            }, h('span', null, '移動'), icon('fa-solid fa-chevron-right text-[8px]'))
        );

        ui.savedContainer.appendChild(card);
    });
}

function toggleSaveLink(id) {
    if (savedLinkIds.includes(id)) {
        savedLinkIds = savedLinkIds.filter(savedId => savedId !== id);
    } else {
        savedLinkIds.push(id);
    }

    localStorage.setItem('saved_link_ids', JSON.stringify(savedLinkIds));
    renderAllLinks();
}

function scrollToLinkInAllLinks(id) {
    switchView('all-links');

    setTimeout(() => {
        const targetCard = document.getElementById(`link-card-${id}`);
        if (targetCard) {
            targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            targetCard.classList.add('highlight-card');
            setTimeout(() => targetCard.classList.remove('highlight-card'), 2000);
        }
    }, 150);
}

window.addEventListener('click', (e) => {
    if (ui.header && !ui.header.contains(e.target)) {
        ui.dropdown.classList.add('hidden');
    }
});

window.addEventListener('DOMContentLoaded', () => {
    buildApp();
    handleOAuthCallback();
});
