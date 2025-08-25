export default class WorldBrowser {
    constructor(core) {
        this.core = core;
        this.worldDatabase = null;
        this.currentTab = 'all';
        this.searchQuery = '';
        this.filters = {
            category: 'all',
            region: 'all',
            status: 'all'
        };
        this.init();
    }

    init() {
        this.core.on('ui:screenShown', (event) => {
            if (event.detail.screen === 'worldBrowser') {
                this.onScreenShown();
            }
        });
        
        this.core.on('core:initialized', () => {
            this.worldDatabase = this.core.getModule('worldDatabase');
            this.bindEvents();
        });
    }

    onScreenShown() {
        if (this.worldDatabase) {
            this.populateFilters();
            this.refreshCurrentTab();
        }
    }

    bindEvents() {
        document.addEventListener('DOMContentLoaded', () => {
            this.setupEventHandlers();
        });

        setTimeout(() => {
            this.setupEventHandlers();
        }, 100);
    }

    setupEventHandlers() {
        // Tab switching
        document.querySelectorAll('.world-tab-button').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Search
        const searchInput = document.getElementById('world-search');
        const searchBtn = document.getElementById('search-btn');
        
        if (searchInput && searchBtn) {
            searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value;
                this.debounceSearch();
            });
            searchBtn.addEventListener('click', () => this.performSearch());
        }

        // Filters
        document.getElementById('category-filter')?.addEventListener('change', (e) => {
            this.filters.category = e.target.value;
            this.applyFilters();
        });

        document.getElementById('region-filter')?.addEventListener('change', (e) => {
            this.filters.region = e.target.value;
            this.applyFilters();
        });

        document.getElementById('status-filter')?.addEventListener('change', (e) => {
            this.filters.status = e.target.value;
            this.applyFilters();
        });

        // Add entity buttons
        document.getElementById('add-npc-btn')?.addEventListener('click', () => this.showAddEntityModal('npc'));
        document.getElementById('add-location-btn')?.addEventListener('click', () => this.showAddEntityModal('location'));
        document.getElementById('add-faction-btn')?.addEventListener('click', () => this.showAddEntityModal('faction'));
        document.getElementById('add-event-btn')?.addEventListener('click', () => this.showAddEntityModal('event'));

        // Timeline controls
        document.getElementById('timeline-filter-major')?.addEventListener('click', () => {
            document.getElementById('timeline-filter-all').classList.remove('active');
            document.getElementById('timeline-filter-major').classList.add('active');
            this.refreshTimeline(true);
        });

        document.getElementById('timeline-filter-all')?.addEventListener('click', () => {
            document.getElementById('timeline-filter-major').classList.remove('active');
            document.getElementById('timeline-filter-all').classList.add('active');
            this.refreshTimeline(false);
        });

        document.getElementById('timeline-date-range')?.addEventListener('change', (e) => {
            this.refreshTimeline(document.getElementById('timeline-filter-major').classList.contains('active'), e.target.value);
        });

        // Relationship controls
        document.getElementById('relationship-focus')?.addEventListener('change', (e) => {
            this.refreshRelationshipMap(e.target.value);
        });

        document.getElementById('relationship-reset')?.addEventListener('click', () => {
            this.refreshRelationshipMap('all');
        });

        // Save entity button
        document.getElementById('save-entity-btn')?.addEventListener('click', () => this.saveEntity());
    }

    switchTab(tabName) {
        document.querySelectorAll('.world-tab-button').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.world-tab-panel').forEach(panel => panel.classList.remove('active'));
        
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        document.getElementById(`${tabName}-world-tab`).classList.add('active');
        
        this.currentTab = tabName;
        this.refreshCurrentTab();
    }

    refreshCurrentTab() {
        switch (this.currentTab) {
            case 'all':
                this.loadAllEntities();
                break;
            case 'npcs':
                this.loadNPCs();
                break;
            case 'locations':
                this.loadLocations();
                break;
            case 'factions':
                this.loadFactions();
                break;
            case 'events':
                this.loadEvents();
                break;
            case 'timeline':
                this.refreshTimeline();
                break;
            case 'relationships':
                this.refreshRelationshipMap();
                break;
        }
    }

    populateFilters() {
        const regions = this.worldDatabase.getUniqueRegions();
        const regionFilter = document.getElementById('region-filter');
        
        if (regionFilter) {
            regionFilter.innerHTML = '<option value="all">All Regions</option>' +
                regions.map(region => `<option value="${region}">${region}</option>`).join('');
        }
    }

    loadAllEntities() {
        const allResults = document.getElementById('all-results');
        if (!allResults) return;

        const npcs = this.worldDatabase.searchNPCs(this.searchQuery, this.getSearchFilters());
        const locations = this.worldDatabase.searchLocations(this.searchQuery, this.getSearchFilters());
        const factions = this.worldDatabase.searchFactions(this.searchQuery, this.getSearchFilters());
        const events = this.worldDatabase.searchEvents(this.searchQuery, this.getSearchFilters());

        allResults.innerHTML = `
            <div class="results-section">
                <h4>NPCs (${npcs.length})</h4>
                <div class="entity-grid">
                    ${npcs.slice(0, 6).map(npc => this.renderNPCCard(npc)).join('')}
                    ${npcs.length > 6 ? `<div class="show-more-card" data-type="npcs">+${npcs.length - 6} more</div>` : ''}
                </div>
            </div>
            <div class="results-section">
                <h4>Locations (${locations.length})</h4>
                <div class="entity-grid">
                    ${locations.slice(0, 6).map(location => this.renderLocationCard(location)).join('')}
                    ${locations.length > 6 ? `<div class="show-more-card" data-type="locations">+${locations.length - 6} more</div>` : ''}
                </div>
            </div>
            <div class="results-section">
                <h4>Factions (${factions.length})</h4>
                <div class="entity-grid">
                    ${factions.slice(0, 4).map(faction => this.renderFactionCard(faction)).join('')}
                    ${factions.length > 4 ? `<div class="show-more-card" data-type="factions">+${factions.length - 4} more</div>` : ''}
                </div>
            </div>
            <div class="results-section">
                <h4>Recent Events (${events.length})</h4>
                <div class="event-preview">
                    ${events.slice(0, 3).map(event => this.renderEventCard(event)).join('')}
                    ${events.length > 3 ? `<div class="show-more-card" data-type="events">+${events.length - 3} more</div>` : ''}
                </div>
            </div>
        `;

        this.bindEntityEvents();
    }

    loadNPCs() {
        const npcResults = document.getElementById('npc-results');
        if (!npcResults) return;

        const npcs = this.worldDatabase.searchNPCs(this.searchQuery, this.getSearchFilters());
        npcResults.innerHTML = npcs.map(npc => this.renderNPCCard(npc, true)).join('') || 
            '<div class="empty-message">No NPCs match your search criteria.</div>';

        this.bindEntityEvents();
    }

    loadLocations() {
        const locationResults = document.getElementById('location-results');
        if (!locationResults) return;

        const locations = this.worldDatabase.searchLocations(this.searchQuery, this.getSearchFilters());
        locationResults.innerHTML = locations.map(location => this.renderLocationCard(location, true)).join('') || 
            '<div class="empty-message">No locations match your search criteria.</div>';

        this.bindEntityEvents();
    }

    loadFactions() {
        const factionResults = document.getElementById('faction-results');
        if (!factionResults) return;

        const factions = this.worldDatabase.searchFactions(this.searchQuery, this.getSearchFilters());
        factionResults.innerHTML = factions.map(faction => this.renderFactionCard(faction, true)).join('') || 
            '<div class="empty-message">No factions match your search criteria.</div>';

        this.bindEntityEvents();
    }

    loadEvents() {
        const eventResults = document.getElementById('event-results');
        if (!eventResults) return;

        const events = this.worldDatabase.searchEvents(this.searchQuery, this.getSearchFilters());
        eventResults.innerHTML = events.map(event => this.renderEventCard(event, true)).join('') || 
            '<div class="empty-message">No events match your search criteria.</div>';

        this.bindEntityEvents();
    }

    refreshTimeline(majorOnly = false, dateRange = 'all') {
        const timelineResults = document.getElementById('timeline-results');
        if (!timelineResults) return;

        const events = this.worldDatabase.getEventsTimeline({
            majorOnly,
            dateRange,
            searchQuery: this.searchQuery
        });

        timelineResults.innerHTML = this.renderTimeline(events);
        this.bindEntityEvents();
    }

    refreshRelationshipMap(focus = 'all') {
        const relationshipMap = document.getElementById('relationship-map');
        if (!relationshipMap) return;

        const relationships = this.worldDatabase.getRelationshipMap(focus);
        relationshipMap.innerHTML = this.renderRelationshipMap(relationships);
        this.bindRelationshipEvents();
    }

    renderNPCCard(npc, detailed = false) {
        const statusClass = npc.status ? `status-${npc.status}` : '';
        return `
            <div class="npc-card entity-card ${statusClass}" data-id="${npc.id}" data-type="npc">
                <div class="card-header">
                    <h4>${npc.name}</h4>
                    <span class="npc-status">${npc.status || 'Unknown'}</span>
                </div>
                <div class="card-content">
                    <p class="npc-occupation">${npc.occupation || 'Unknown occupation'}</p>
                    <p class="npc-location">${npc.location || 'Location unknown'}</p>
                    ${detailed ? `<p class="npc-description">${npc.personality?.slice(0, 100)}${npc.personality?.length > 100 ? '...' : ''}</p>` : ''}
                </div>
                <div class="card-footer">
                    <button class="view-details-btn" data-id="${npc.id}" data-type="npc">View Details</button>
                    ${detailed ? `<button class="edit-entity-btn" data-id="${npc.id}" data-type="npc">Edit</button>` : ''}
                </div>
            </div>
        `;
    }

    renderLocationCard(location, detailed = false) {
        return `
            <div class="location-card entity-card" data-id="${location.id}" data-type="location">
                <div class="card-header">
                    <h4>${location.name}</h4>
                    <span class="location-type">${location.type || 'Location'}</span>
                </div>
                <div class="card-content">
                    <p class="location-region">${location.region || 'Unknown region'}</p>
                    ${detailed ? `<p class="location-description">${location.description?.slice(0, 100)}${location.description?.length > 100 ? '...' : ''}</p>` : ''}
                </div>
                <div class="card-footer">
                    <button class="view-details-btn" data-id="${location.id}" data-type="location">View Details</button>
                    ${detailed ? `<button class="edit-entity-btn" data-id="${location.id}" data-type="location">Edit</button>` : ''}
                </div>
            </div>
        `;
    }

    renderFactionCard(faction, detailed = false) {
        const statusClass = faction.status ? `status-${faction.status}` : '';
        return `
            <div class="faction-card entity-card ${statusClass}" data-id="${faction.id}" data-type="faction">
                <div class="card-header">
                    <h4>${faction.name}</h4>
                    <span class="faction-status">${faction.status || 'Neutral'}</span>
                </div>
                <div class="card-content">
                    <p class="faction-type">${faction.type || 'Organization'}</p>
                    <p class="faction-power">Power Level: ${faction.powerLevel || 'Unknown'}</p>
                    ${detailed ? `<p class="faction-description">${faction.description?.slice(0, 100)}${faction.description?.length > 100 ? '...' : ''}</p>` : ''}
                </div>
                <div class="card-footer">
                    <button class="view-details-btn" data-id="${faction.id}" data-type="faction">View Details</button>
                    ${detailed ? `<button class="edit-entity-btn" data-id="${faction.id}" data-type="faction">Edit</button>` : ''}
                </div>
            </div>
        `;
    }

    renderEventCard(event, detailed = false) {
        return `
            <div class="event-card entity-card" data-id="${event.id}" data-type="event">
                <div class="card-header">
                    <h4>${event.title}</h4>
                    <span class="event-date">${event.dateOccurred ? new Date(event.dateOccurred).toLocaleDateString() : 'Ongoing'}</span>
                </div>
                <div class="card-content">
                    <p class="event-description">${event.description?.slice(0, 100)}${event.description?.length > 100 ? '...' : ''}</p>
                    ${detailed ? `
                        <div class="event-participants">
                            ${event.participants?.slice(0, 3).map(p => `<span class="participant">${p}</span>`).join('') || ''}
                            ${event.participants?.length > 3 ? `<span class="more-participants">+${event.participants.length - 3}</span>` : ''}
                        </div>
                    ` : ''}
                </div>
                <div class="card-footer">
                    <button class="view-details-btn" data-id="${event.id}" data-type="event">View Details</button>
                    ${detailed ? `<button class="edit-entity-btn" data-id="${event.id}" data-type="event">Edit</button>` : ''}
                </div>
            </div>
        `;
    }

    renderTimeline(events) {
        if (!events || events.length === 0) {
            return '<div class="empty-message">No events found for the selected timeline.</div>';
        }

        return events.map(event => `
            <div class="timeline-event" data-id="${event.id}">
                <div class="timeline-date">${event.dateOccurred ? new Date(event.dateOccurred).toLocaleDateString() : 'Ongoing'}</div>
                <div class="timeline-content">
                    <h4>${event.title}</h4>
                    <p>${event.description}</p>
                    <div class="timeline-participants">
                        ${event.participants?.map(p => `<span class="participant">${p}</span>`).join('') || ''}
                    </div>
                </div>
                <div class="timeline-actions">
                    <button class="view-details-btn" data-id="${event.id}" data-type="event">Details</button>
                </div>
            </div>
        `).join('');
    }

    renderRelationshipMap(relationships) {
        if (!relationships || Object.keys(relationships).length === 0) {
            return '<div class="empty-message">No relationships found.</div>';
        }

        // Simple text-based relationship display for now
        // In a full implementation, this would be a visual graph/network diagram
        let html = '<div class="relationship-list">';
        
        Object.entries(relationships).forEach(([entityId, relations]) => {
            const entity = this.worldDatabase.getEntityById(entityId);
            if (!entity) return;

            html += `
                <div class="relationship-group">
                    <h4>${entity.name || entity.title} (${entity.type})</h4>
                    <div class="relationships">
                        ${relations.map(rel => `
                            <div class="relationship-item">
                                <span class="relationship-type">${rel.type}:</span>
                                <span class="related-entity">${rel.targetName}</span>
                                <span class="relationship-strength">(${rel.strength})</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        });

        html += '</div>';
        return html;
    }

    bindEntityEvents() {
        // View details buttons
        document.querySelectorAll('.view-details-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const entityId = e.target.dataset.id;
                const entityType = e.target.dataset.type;
                this.showEntityDetails(entityId, entityType);
            });
        });

        // Edit entity buttons
        document.querySelectorAll('.edit-entity-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const entityId = e.target.dataset.id;
                const entityType = e.target.dataset.type;
                this.showEditEntityModal(entityId, entityType);
            });
        });

        // Show more cards
        document.querySelectorAll('.show-more-card').forEach(card => {
            card.addEventListener('click', (e) => {
                const type = e.target.dataset.type;
                this.switchTab(type);
            });
        });
    }

    bindRelationshipEvents() {
        // Add click handlers for relationship map interactions
        document.querySelectorAll('.relationship-item').forEach(item => {
            item.addEventListener('click', (e) => {
                // Future: Show relationship details or navigate to related entity
            });
        });
    }

    showEntityDetails(entityId, entityType) {
        const entity = this.worldDatabase.getEntityById(entityId);
        if (!entity) return;

        const modal = document.getElementById('world-detail-modal');
        const title = document.getElementById('detail-title');
        const body = document.getElementById('detail-body');

        title.textContent = entity.name || entity.title;
        body.innerHTML = this.renderEntityDetails(entity, entityType);

        modal.style.display = 'flex';
    }

    renderEntityDetails(entity, type) {
        switch (type) {
            case 'npc':
                return `
                    <div class="entity-details npc-details">
                        <div class="detail-section">
                            <h4>Basic Information</h4>
                            <p><strong>Name:</strong> ${entity.name}</p>
                            <p><strong>Occupation:</strong> ${entity.occupation || 'Unknown'}</p>
                            <p><strong>Location:</strong> ${entity.location || 'Unknown'}</p>
                            <p><strong>Status:</strong> ${entity.status || 'Unknown'}</p>
                        </div>
                        <div class="detail-section">
                            <h4>Personality</h4>
                            <p>${entity.personality || 'No personality information available.'}</p>
                        </div>
                        <div class="detail-section">
                            <h4>Background</h4>
                            <p>${entity.background || 'No background information available.'}</p>
                        </div>
                        <div class="detail-section">
                            <h4>Relationships</h4>
                            <div class="relationships-list">
                                ${entity.relationships?.map(rel => `
                                    <div class="relationship">
                                        <span class="rel-type">${rel.type}:</span>
                                        <span class="rel-target">${rel.target}</span>
                                        <span class="rel-strength">(${rel.strength})</span>
                                    </div>
                                `).join('') || 'No known relationships.'}
                            </div>
                        </div>
                    </div>
                `;
            case 'location':
                return `
                    <div class="entity-details location-details">
                        <div class="detail-section">
                            <h4>Location Information</h4>
                            <p><strong>Name:</strong> ${entity.name}</p>
                            <p><strong>Type:</strong> ${entity.type || 'Unknown'}</p>
                            <p><strong>Region:</strong> ${entity.region || 'Unknown'}</p>
                        </div>
                        <div class="detail-section">
                            <h4>Description</h4>
                            <p>${entity.description || 'No description available.'}</p>
                        </div>
                        <div class="detail-section">
                            <h4>Political Situation</h4>
                            <p>${entity.politicalSituation || 'No political information available.'}</p>
                        </div>
                        <div class="detail-section">
                            <h4>Notable NPCs</h4>
                            <div class="npcs-list">
                                ${entity.npcs?.map(npcId => {
                                    const npc = this.worldDatabase.getNPC(npcId);
                                    return npc ? `<div class="npc-link" data-id="${npcId}">${npc.name}</div>` : '';
                                }).join('') || 'No notable NPCs.'}
                            </div>
                        </div>
                    </div>
                `;
            case 'faction':
                return `
                    <div class="entity-details faction-details">
                        <div class="detail-section">
                            <h4>Faction Information</h4>
                            <p><strong>Name:</strong> ${entity.name}</p>
                            <p><strong>Type:</strong> ${entity.type || 'Unknown'}</p>
                            <p><strong>Status:</strong> ${entity.status || 'Neutral'}</p>
                            <p><strong>Power Level:</strong> ${entity.powerLevel || 'Unknown'}</p>
                        </div>
                        <div class="detail-section">
                            <h4>Description</h4>
                            <p>${entity.description || 'No description available.'}</p>
                        </div>
                        <div class="detail-section">
                            <h4>Goals</h4>
                            <p>${entity.goals || 'Goals unknown.'}</p>
                        </div>
                        <div class="detail-section">
                            <h4>Key Members</h4>
                            <div class="members-list">
                                ${entity.members?.map(memberId => {
                                    const member = this.worldDatabase.getNPC(memberId);
                                    return member ? `<div class="member-link" data-id="${memberId}">${member.name}</div>` : '';
                                }).join('') || 'No known members.'}
                            </div>
                        </div>
                    </div>
                `;
            case 'event':
                return `
                    <div class="entity-details event-details">
                        <div class="detail-section">
                            <h4>Event Information</h4>
                            <p><strong>Title:</strong> ${entity.title}</p>
                            <p><strong>Date:</strong> ${entity.dateOccurred ? new Date(entity.dateOccurred).toLocaleDateString() : 'Ongoing'}</p>
                            <p><strong>Location:</strong> ${entity.location || 'Unknown'}</p>
                        </div>
                        <div class="detail-section">
                            <h4>Description</h4>
                            <p>${entity.description || 'No description available.'}</p>
                        </div>
                        <div class="detail-section">
                            <h4>Participants</h4>
                            <div class="participants-list">
                                ${entity.participants?.map(p => `<div class="participant">${p}</div>`).join('') || 'No participants recorded.'}
                            </div>
                        </div>
                        <div class="detail-section">
                            <h4>Consequences</h4>
                            <div class="consequences-list">
                                ${entity.consequences?.map(c => `<div class="consequence">${c}</div>`).join('') || 'No consequences recorded.'}
                            </div>
                        </div>
                    </div>
                `;
            default:
                return '<p>Unknown entity type.</p>';
        }
    }

    showAddEntityModal(entityType) {
        const modal = document.getElementById('entity-form-modal');
        const title = document.getElementById('entity-form-title');
        const fields = document.getElementById('entity-form-fields');

        title.textContent = `Add ${entityType.charAt(0).toUpperCase() + entityType.slice(1)}`;
        fields.innerHTML = this.generateEntityForm(entityType);

        modal.style.display = 'flex';
        modal.dataset.entityType = entityType;
        modal.dataset.entityId = '';
    }

    showEditEntityModal(entityId, entityType) {
        const entity = this.worldDatabase.getEntityById(entityId);
        if (!entity) return;

        const modal = document.getElementById('entity-form-modal');
        const title = document.getElementById('entity-form-title');
        const fields = document.getElementById('entity-form-fields');

        title.textContent = `Edit ${entityType.charAt(0).toUpperCase() + entityType.slice(1)}`;
        fields.innerHTML = this.generateEntityForm(entityType, entity);

        modal.style.display = 'flex';
        modal.dataset.entityType = entityType;
        modal.dataset.entityId = entityId;
    }

    generateEntityForm(entityType, entity = {}) {
        const forms = {
            npc: `
                <div class="form-group">
                    <label>Name *</label>
                    <input type="text" name="name" value="${entity.name || ''}" required>
                </div>
                <div class="form-group">
                    <label>Occupation</label>
                    <input type="text" name="occupation" value="${entity.occupation || ''}">
                </div>
                <div class="form-group">
                    <label>Location</label>
                    <input type="text" name="location" value="${entity.location || ''}">
                </div>
                <div class="form-group">
                    <label>Status</label>
                    <select name="status">
                        <option value="friendly" ${entity.status === 'friendly' ? 'selected' : ''}>Friendly</option>
                        <option value="neutral" ${entity.status === 'neutral' ? 'selected' : ''}>Neutral</option>
                        <option value="hostile" ${entity.status === 'hostile' ? 'selected' : ''}>Hostile</option>
                        <option value="unknown" ${entity.status === 'unknown' ? 'selected' : ''}>Unknown</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Personality</label>
                    <textarea name="personality" rows="3">${entity.personality || ''}</textarea>
                </div>
                <div class="form-group">
                    <label>Background</label>
                    <textarea name="background" rows="3">${entity.background || ''}</textarea>
                </div>
            `,
            location: `
                <div class="form-group">
                    <label>Name *</label>
                    <input type="text" name="name" value="${entity.name || ''}" required>
                </div>
                <div class="form-group">
                    <label>Type</label>
                    <input type="text" name="type" value="${entity.type || ''}" placeholder="e.g., City, Tavern, Forest">
                </div>
                <div class="form-group">
                    <label>Region</label>
                    <input type="text" name="region" value="${entity.region || ''}">
                </div>
                <div class="form-group">
                    <label>Description</label>
                    <textarea name="description" rows="4">${entity.description || ''}</textarea>
                </div>
                <div class="form-group">
                    <label>Political Situation</label>
                    <textarea name="politicalSituation" rows="3">${entity.politicalSituation || ''}</textarea>
                </div>
            `,
            faction: `
                <div class="form-group">
                    <label>Name *</label>
                    <input type="text" name="name" value="${entity.name || ''}" required>
                </div>
                <div class="form-group">
                    <label>Type</label>
                    <input type="text" name="type" value="${entity.type || ''}" placeholder="e.g., Guild, Military, Religious">
                </div>
                <div class="form-group">
                    <label>Status</label>
                    <select name="status">
                        <option value="friendly" ${entity.status === 'friendly' ? 'selected' : ''}>Friendly</option>
                        <option value="neutral" ${entity.status === 'neutral' ? 'selected' : ''}>Neutral</option>
                        <option value="hostile" ${entity.status === 'hostile' ? 'selected' : ''}>Hostile</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Power Level</label>
                    <select name="powerLevel">
                        <option value="low" ${entity.powerLevel === 'low' ? 'selected' : ''}>Low</option>
                        <option value="moderate" ${entity.powerLevel === 'moderate' ? 'selected' : ''}>Moderate</option>
                        <option value="high" ${entity.powerLevel === 'high' ? 'selected' : ''}>High</option>
                        <option value="dominant" ${entity.powerLevel === 'dominant' ? 'selected' : ''}>Dominant</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Description</label>
                    <textarea name="description" rows="3">${entity.description || ''}</textarea>
                </div>
                <div class="form-group">
                    <label>Goals</label>
                    <textarea name="goals" rows="3">${entity.goals || ''}</textarea>
                </div>
            `,
            event: `
                <div class="form-group">
                    <label>Title *</label>
                    <input type="text" name="title" value="${entity.title || ''}" required>
                </div>
                <div class="form-group">
                    <label>Date Occurred</label>
                    <input type="date" name="dateOccurred" value="${entity.dateOccurred ? entity.dateOccurred.split('T')[0] : ''}">
                </div>
                <div class="form-group">
                    <label>Location</label>
                    <input type="text" name="location" value="${entity.location || ''}">
                </div>
                <div class="form-group">
                    <label>Description</label>
                    <textarea name="description" rows="4">${entity.description || ''}</textarea>
                </div>
                <div class="form-group">
                    <label>Importance</label>
                    <select name="importance">
                        <option value="minor" ${entity.importance === 'minor' ? 'selected' : ''}>Minor</option>
                        <option value="moderate" ${entity.importance === 'moderate' ? 'selected' : ''}>Moderate</option>
                        <option value="major" ${entity.importance === 'major' ? 'selected' : ''}>Major</option>
                        <option value="critical" ${entity.importance === 'critical' ? 'selected' : ''}>Critical</option>
                    </select>
                </div>
            `
        };

        return forms[entityType] || '<p>Unknown entity type</p>';
    }

    saveEntity() {
        const modal = document.getElementById('entity-form-modal');
        const entityType = modal.dataset.entityType;
        const entityId = modal.dataset.entityId;
        const form = document.getElementById('entity-form');
        const formData = new FormData(form);

        const entityData = {};
        for (let [key, value] of formData.entries()) {
            entityData[key] = value;
        }

        if (entityId) {
            // Update existing entity
            this.worldDatabase.updateEntity(entityId, entityData);
            this.showNotification(`${entityType.charAt(0).toUpperCase() + entityType.slice(1)} updated successfully`, 'success');
        } else {
            // Create new entity
            this.worldDatabase.createEntity(entityType, entityData);
            this.showNotification(`${entityType.charAt(0).toUpperCase() + entityType.slice(1)} created successfully`, 'success');
        }

        modal.style.display = 'none';
        this.refreshCurrentTab();
    }

    getSearchFilters() {
        return {
            category: this.filters.category !== 'all' ? this.filters.category : null,
            region: this.filters.region !== 'all' ? this.filters.region : null,
            status: this.filters.status !== 'all' ? this.filters.status : null
        };
    }

    debounceSearch() {
        clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(() => {
            this.performSearch();
        }, 300);
    }

    performSearch() {
        this.refreshCurrentTab();
    }

    applyFilters() {
        this.refreshCurrentTab();
    }

    showNotification(message, type = 'info') {
        const ui = this.core.getModule('ui');
        if (ui && ui.showNotification) {
            ui.showNotification(message, type);
        } else {
            console.log(`${type.toUpperCase()}: ${message}`);
        }
    }
}